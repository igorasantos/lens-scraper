import { Inject, Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '@app/browser';
import { browserContextForMode, SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { LOCK_PORT, SESSION_LOCK_KEY, type LockPort } from '@app/redis-lock';
import { ConfigService } from '@app/config';
import {
  QueueService,
  type ListingInitMessage,
  type ListingPageMessage,
} from '@app/queue';
import { ListingDispatchService } from './listing-dispatch.service.js';
import { sleep, waitUntil } from '../common/pacing.util.js';
type PageState = Omit<ListingPageMessage, 'scheduledAt'>;
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
  async start(message: ListingInitMessage): Promise<void> {
    const {
      runId,
      baseUrl,
      listingMode,
      detailMode,
      startPage = 1,
      recycle = false,
      dispatchCount,
    } = message;
    const token = await this.lock.acquire(
      SESSION_LOCK_KEY,
      this.config.lockTtlMs,
    );
    if (!token) {
      await sleep(this.config.lockBusyRequeueWaitMs);
      await this.queue.publishListingInit({
        runId,
        baseUrl,
        listingMode,
        detailMode,
        startPage,
        recycle,
        dispatchCount,
      });
      this.logger.debug(
        `[${runId}] Site session lock is busy; requeued the listing init message.`,
      );
      return;
    }
    if (this.config.maxListingPages <= 0) {
      this.logger.warn(
        `[${runId}] MAX_LISTING_PAGES=${this.config.maxListingPages}; nothing to crawl.`,
      );
      await this.finish({
        runId,
        baseUrl,
        listingMode,
        detailMode,
        pagesVisited: 0,
        recordIds: [],
        lockToken: token,
        recycle,
        dispatchCount,
      });
      return;
    }
    if (listingMode === 'logged-out' && startPage !== 1) {
      this.logger.warn(
        `[${runId}] startPage=${startPage} is ignored in logged-out listing mode; only the first listing batch is read.`,
      );
    }
    await this.runPage({
      runId,
      baseUrl,
      listingMode,
      detailMode,
      pagesVisited: listingMode === 'logged-out' ? 0 : startPage - 1,
      recordIds: [],
      lockToken: token,
      recycle,
      dispatchCount,
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
      if (state.listingMode === 'logged-out') {
        await this.processSingleBatch(state);
      } else {
        await this.processPage(state);
      }
    } catch (error) {
      await this.lock.release(SESSION_LOCK_KEY, state.lockToken);
      throw error;
    }
  }
  private async processSingleBatch(state: PageState): Promise<void> {
    const { runId, baseUrl, listingMode } = state;
    const page = await this.browser.newPage({
      kind: browserContextForMode(listingMode),
    });
    let recordIds: string[];
    try {
      this.logger.log(`[${runId}] Fetching the first listing batch`);
      await this.browser.goto(page, baseUrl);
      recordIds = await this.site.extractRecordIds(page, listingMode);
    } finally {
      await this.browser.closePage(page);
    }
    if (recordIds.length > 0) {
      await this.storage.appendRawListingIds(runId, recordIds);
    }
    this.logger.log(
      `[${runId}] Read ${recordIds.length} record id(s) from the first listing batch; logged-out listing mode does not paginate.`,
    );
    await this.finish({ ...state, recordIds });
  }
  private async processPage(state: PageState): Promise<void> {
    const { runId, baseUrl, listingMode, pagesVisited, recordIds, lockToken } =
      state;
    const start = pagesVisited * this.site.listingPageSize;
    const page = await this.browser.newPage({
      kind: browserContextForMode(listingMode),
    });
    let pageRecordIds: string[];
    try {
      const url = this.site.buildListingPageUrl(baseUrl, start);
      this.logger.log(`[${runId}] Fetching listing page (start=${start})`);
      await this.browser.goto(page, url);
      await this.browser.scrollRandomly(
        page,
        this.site.listingScrollFocusSelector,
      );
      pageRecordIds = await this.site.extractRecordIds(page, listingMode);
    } finally {
      await this.browser.closePage(page);
    }
    if (pageRecordIds.length === 0) {
      this.logger.log(
        `[${runId}] Empty page at start=${start}; stopping pagination.`,
      );
      await this.finish(state);
      return;
    }
    await this.storage.appendRawListingIds(runId, pageRecordIds);
    const accumulated = [...recordIds, ...pageRecordIds];
    const nextPagesVisited = pagesVisited + 1;
    if (nextPagesVisited >= this.config.maxListingPages) {
      this.logger.warn(
        `[${runId}] Reached MAX_LISTING_PAGES=${this.config.maxListingPages} without hitting an empty page.`,
      );
      await this.finish({ ...state, recordIds: accumulated });
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
      ...state,
      pagesVisited: nextPagesVisited,
      recordIds: accumulated,
      scheduledAt,
    });
  }
  private async finish(state: PageState): Promise<void> {
    const { runId, recordIds, lockToken, detailMode, recycle, dispatchCount } =
      state;
    try {
      await this.dispatch.dispatch(runId, recordIds, {
        detailMode,
        recycle: recycle ?? false,
        dispatchCount,
      });
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
