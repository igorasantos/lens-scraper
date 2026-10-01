import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Frame } from 'playwright';
import { BrowserService } from '@app/browser';
import {
  guessLanguageAlpha2,
  SiteService,
  UNKNOWN_LANGUAGE_ALPHA2,
  type RecordDetailExtractionResult,
} from '@app/site';
import { StorageService } from '@app/storage';
import { LOCK_PORT, SESSION_LOCK_KEY, type LockPort } from '@app/redis-lock';
import { ConfigService } from '@app/config';
import type { RecordDetailMessage } from '@app/queue';
import { sleep, waitUntil } from '../common/pacing.util.js';
const MANUAL_RUN_ID = 'manual';
function extractionExceededMessage(attempts: number): string {
  return `Data extraction attempt limit exceeded (${attempts} attempts).`;
}
@Injectable()
export class DetailScraperService {
  private readonly logger = new Logger(DetailScraperService.name);
  constructor(
    private readonly browser: BrowserService,
    private readonly site: SiteService,
    private readonly storage: StorageService,
    @Inject(LOCK_PORT)
    private readonly lock: LockPort,
    private readonly config: ConfigService,
  ) {}
  async handle(message: RecordDetailMessage): Promise<void> {
    const { recordId } = message;
    const runId = message.runId ?? MANUAL_RUN_ID;
    await waitUntil(this.nextWaitTarget());
    const token = await this.lock.acquire(
      SESSION_LOCK_KEY,
      this.config.lockTtlMs,
    );
    if (!token) {
      throw new Error(
        `[${recordId}] Could not acquire the site session lock; another worker holds it.`,
      );
    }
    try {
      await this.scrape(runId, message, token);
    } finally {
      await this.lock.release(SESSION_LOCK_KEY, token);
    }
  }
  private async scrape(
    runId: string,
    message: RecordDetailMessage,
    lockToken: string,
  ): Promise<void> {
    const recordId = message.recordId;
    const page = await this.browser.newPage();
    const maxAttempts = this.config.maxExtractionAttempts;
    let redirectedTo: string | null = null;
    const onFrameNavigated = (frame: Frame): void => {
      if (
        frame === page.mainFrame() &&
        !this.site.isRecordDetailUrl(frame.url(), recordId)
      ) {
        redirectedTo = frame.url();
      }
    };
    try {
      page.on('framenavigated', onFrameNavigated);
      try {
        await this.browser.goto(page, this.site.buildRecordDetailUrl(recordId));
        if (redirectedTo) {
          await this.persistRedirected(runId, recordId, redirectedTo);
          return;
        }
        await this.browser.scrollRandomly(page, this.site.scrollFocusSelector);
        let attempts = 0;
        let last: RecordDetailExtractionResult = {
          sectionFound: false,
          hasBodyContent: false,
          html: null,
          bodyContentText: null,
          sourceName: null,
          sourceHtml: null,
          isExpired: false,
        };
        while (attempts < maxAttempts && !redirectedTo) {
          attempts++;
          const renewed = await this.lock.extend(
            SESSION_LOCK_KEY,
            lockToken,
            this.config.lockTtlMs,
          );
          if (!renewed) {
            throw new Error(
              `[${recordId}] Lost the site session lock during extraction.`,
            );
          }
          await sleep(this.config.fixedWaitMs);
          if (redirectedTo) {
            break;
          }
          last = await this.site.extractRecordDetail(page, recordId);
          if (last.sectionFound && last.hasBodyContent) {
            break;
          }
        }
        if (redirectedTo) {
          await this.persistRedirected(runId, recordId, redirectedTo);
          return;
        }
        await this.persist(runId, message, attempts, last);
      } finally {
        page.off('framenavigated', onFrameNavigated);
      }
    } finally {
      await this.browser.closePage(page);
    }
  }
  private async persist(
    runId: string,
    message: RecordDetailMessage,
    attempts: number,
    result: RecordDetailExtractionResult,
  ): Promise<void> {
    const recordId = message.recordId;
    const languageAlpha2 = guessLanguageAlpha2(result.bodyContentText ?? '');
    if (!result.sectionFound) {
      const error = extractionExceededMessage(attempts);
      this.logger.warn(
        `[${recordId}] selector missing or empty after ${attempts} attempt(s).`,
      );
      await this.storage.writeRecordDetail(languageAlpha2, recordId, error);
      await this.storage.appendFailure(runId, {
        recordId,
        reason: 'missing-section',
        attempts,
      });
    } else {
      if (!result.hasBodyContent) {
        this.logger.warn(
          `[${recordId}] body content never completed after ${attempts} attempt(s); writing the last attempt anyway.`,
        );
        await this.storage.appendFailure(runId, {
          recordId,
          reason: 'body-content-incomplete',
          attempts,
        });
      }
      if (result.isExpired) {
        this.logger.log(`[${recordId}] "not available"; recording as expired.`);
        await this.storage.writeExpiredRecordDetail(
          recordId,
          result.html ?? '',
        );
        await this.storage.appendExpiredRecord(recordId);
      } else {
        await this.storage.writeRecordDetail(
          languageAlpha2,
          recordId,
          result.html ?? '',
        );
        await this.storage.removeExpiredRecord(recordId);
      }
      if (result.sourceName && result.sourceHtml) {
        const isNewSource = await this.storage.appendSourceName(
          result.sourceName,
        );
        if (isNewSource) {
          await this.storage.writeSourceDetail(
            result.sourceName,
            result.sourceHtml,
          );
        }
      }
    }
    await this.storage.appendRecordId(recordId, languageAlpha2);
    if (result.isExpired || languageAlpha2 !== UNKNOWN_LANGUAGE_ALPHA2) {
      await this.storage.migrateOutOfUnknownLanguageBucket(recordId);
    }
  }
  private async persistRedirected(
    runId: string,
    recordId: string,
    redirectedTo: string,
  ): Promise<void> {
    this.logger.warn(
      `[${recordId}] the site redirected away from the record detail page to '${redirectedTo}'; recording under '${UNKNOWN_LANGUAGE_ALPHA2}' without retrying.`,
    );
    await this.storage.appendFailure(runId, {
      recordId,
      reason: 'redirected',
      attempts: 0,
    });
    await this.storage.appendRecordId(recordId, UNKNOWN_LANGUAGE_ALPHA2);
  }
  private nextWaitTarget(): number {
    const minMs = this.config.recordDetailWaitMinSec * 1000;
    const maxMs = this.config.recordDetailWaitMaxSec * 1000;
    const randomMs = minMs + Math.random() * (maxMs - minMs);
    return Date.now() + randomMs;
  }
}
