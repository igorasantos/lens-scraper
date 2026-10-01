import { Inject, Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '@app/browser';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { LOCK_PORT, SESSION_LOCK_KEY, type LockPort } from '@app/redis-lock';
import { ConfigService } from '@app/config';
import { QueueService, type ListingPageMessage } from '@app/queue';
import { ListingDispatchService } from './listing-dispatch.service.js';
import { waitUntil } from '../common/pacing.util.js';
interface PageState {
  runId: string;
  baseUrl: string;
  pagesVisited: number;
  recordIds: string[];
  lockToken: string;
}
@Injectable()
export class ListingCrawlerService {
  private readonly logger = new Logger(ListingCrawlerService.name);
  constructor(
    private readonly browser: BrowserService,
    private readonly site: SiteService,
    private readonly storage: StorageService,
    @Inject(LOCK_PORT)
    private readonly lock: LockPort,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    private readonly dispatch: ListingDispatchService,
  ) {}
  async start(runId: string, baseUrl: string, startPage = 1): Promise<void> {
    const token = await this.lock.acquire(
      SESSION_LOCK_KEY,
      this.config.lockTtlMs,
    );
    if (!token) {
      throw new Error(
        `[${runId}] Could not acquire the site session lock; another worker holds it.`,
      );
    }
    if (this.config.maxListingPages <= 0) {
      this.logger.warn(
        `[${runId}] MAX_LISTING_PAGES=${this.config.maxListingPages}; nothing to crawl.`,
      );
      await this.finish(runId, [], token);
      return;
    }
    await this.runPage({
      runId,
      baseUrl,
      pagesVisited: startPage - 1,
      recordIds: [],
      lockToken: token,
    });
  }
  async continuePage(message: ListingPageMessage): Promise<void> {
    await waitUntil(this.nextWaitTarget(message.pagesVisited));
    const renewed = await this.lock.extend(
      SESSION_LOCK_KEY,
      message.lockToken,
      this.config.lockTtlMs,
    );
    if (!renewed) {
      throw new Error(
        `[${message.runId}] Lost the site session lock between listing pages.`,
      );
    }
    await this.runPage(message);
  }
  private async runPage(state: PageState): Promise<void> {
    try {
      await this.processPage(state);
    } catch (error) {
      await this.lock.release(SESSION_LOCK_KEY, state.lockToken);
      throw error;
    }
  }
  private async processPage(state: PageState): Promise<void> {
    const { runId, baseUrl, pagesVisited, recordIds, lockToken } = state;
    const start = pagesVisited * this.site.listingPageSize;
    const page = await this.browser.newPage();
    let pageRecordIds: string[];
    try {
      const url = this.site.buildListingPageUrl(baseUrl, start);
      this.logger.log(`[${runId}] Fetching listing page (start=${start})`);
      await this.browser.goto(page, url);
      await this.browser.scrollRandomly(page, this.site.scrollFocusSelector);
      pageRecordIds = await this.site.extractRecordIds(page);
    } finally {
      await this.browser.closePage(page);
    }
    if (pageRecordIds.length === 0) {
      this.logger.log(
        `[${runId}] Empty page at start=${start}; stopping pagination.`,
      );
      await this.finish(runId, recordIds, lockToken);
      return;
    }
    await this.storage.appendRawListingIds(runId, pageRecordIds);
    const accumulated = [...recordIds, ...pageRecordIds];
    const nextPagesVisited = pagesVisited + 1;
    if (nextPagesVisited >= this.config.maxListingPages) {
      this.logger.warn(
        `[${runId}] Reached MAX_LISTING_PAGES=${this.config.maxListingPages} without hitting an empty page.`,
      );
      await this.finish(runId, accumulated, lockToken);
      return;
    }
    const delaySeconds = this.delayForPage(nextPagesVisited);
    const scheduledAt = new Date(
      Date.now() + delaySeconds * 1000,
    ).toISOString();
    const extended = await this.lock.extend(
      SESSION_LOCK_KEY,
      lockToken,
      Math.round(delaySeconds * 1000 + this.config.lockTtlMs),
    );
    if (!extended) {
      throw new Error(`[${runId}] Lost the site session lock mid-crawl.`);
    }
    this.logger.log(
      `[${runId}] Waiting ${delaySeconds}s before next listing page.`,
    );
    await this.queue.publishListingPage({
      runId,
      baseUrl,
      pagesVisited: nextPagesVisited,
      recordIds: accumulated,
      lockToken,
      scheduledAt,
    });
  }
  private async finish(
    runId: string,
    recordIds: string[],
    lockToken: string,
  ): Promise<void> {
    try {
      await this.dispatch.dispatch(runId, recordIds);
    } finally {
      await this.lock.release(SESSION_LOCK_KEY, lockToken);
    }
  }
  private delayForPage(pagesVisited: number): number {
    return ((pagesVisited % 3) + pagesVisited) * (Math.PI / 2);
  }
  private nextWaitTarget(pagesVisited: number): number {
    return Date.now() + this.delayForPage(pagesVisited) * 1000;
  }
}
