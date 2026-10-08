import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'playwright';
import { BrowserService } from '@app/browser';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { LOCK_PORT, SESSION_LOCK_KEY } from '@app/redis-lock';
import { ConfigService } from '@app/config';
import { QueueService, type ListingInitMessage } from '@app/queue';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { ListingDispatchService } from './listing-dispatch.service.js';
describe('ListingCrawlerService', () => {
  const baseUrl = 'https://www.site.com/search?keywords=123';
  function initMessage(
    overrides: Partial<ListingInitMessage> = {},
  ): ListingInitMessage {
    return {
      runId: 'run-1',
      baseUrl,
      listingMode: 'logged-in',
      detailMode: 'logged-out',
      ...overrides,
    };
  }
  let page: {
    goto: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let browser: {
    newPage: ReturnType<typeof vi.fn>;
    goto: ReturnType<typeof vi.fn>;
    scrollRandomly: ReturnType<typeof vi.fn>;
    closePage: ReturnType<typeof vi.fn>;
  };
  let site: {
    listingPageSize: number;
    listingScrollFocusSelector: string;
    buildListingPageUrl: ReturnType<typeof vi.fn>;
    extractRecordIds: ReturnType<typeof vi.fn>;
  };
  let storage: {
    appendRawListingIds: ReturnType<typeof vi.fn>;
  };
  let lock: {
    acquire: ReturnType<typeof vi.fn>;
    extend: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let config: {
    maxListingPages: number;
    lockTtlMs: number;
    lockBusyRequeueWaitMs: number;
  };
  let queue: {
    publishListingPage: ReturnType<typeof vi.fn>;
    publishListingInit: ReturnType<typeof vi.fn>;
  };
  let dispatch: {
    dispatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<ListingCrawlerService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingCrawlerService,
        { provide: BrowserService, useValue: browser },
        { provide: SiteService, useValue: site },
        { provide: StorageService, useValue: storage },
        { provide: LOCK_PORT, useValue: lock },
        { provide: ConfigService, useValue: config },
        { provide: QueueService, useValue: queue },
        { provide: ListingDispatchService, useValue: dispatch },
      ],
    }).compile();
    return module.get<ListingCrawlerService>(ListingCrawlerService);
  }
  beforeEach(() => {
    page = {
      goto: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    browser = {
      newPage: vi.fn().mockResolvedValue(page as unknown as Page),
      goto: vi.fn((p: { goto: (url: string) => Promise<void> }, url: string) =>
        p.goto(url),
      ),
      scrollRandomly: vi.fn().mockResolvedValue(undefined),
      closePage: vi.fn((p: { close: () => Promise<void> }) => p.close()),
    };
    site = {
      listingPageSize: 25,
      listingScrollFocusSelector: '#app',
      buildListingPageUrl: vi.fn(
        (url: string, start: number) => `${url}&start=${start}`,
      ),
      extractRecordIds: vi.fn(),
    };
    storage = { appendRawListingIds: vi.fn().mockResolvedValue(undefined) };
    lock = {
      acquire: vi.fn().mockResolvedValue('token-1'),
      extend: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(true),
    };
    config = {
      maxListingPages: 50,
      lockTtlMs: 90000,
      lockBusyRequeueWaitMs: 5000,
    };
    queue = {
      publishListingPage: vi.fn().mockResolvedValue(undefined),
      publishListingInit: vi.fn().mockResolvedValue(undefined),
    };
    dispatch = {
      dispatch: vi.fn().mockResolvedValue({ dispatched: [], skipped: [] }),
    };
  });
  describe('start', () => {
    it('fetches the first page inline and publishes the second as a scheduled message', async () => {
      site.extractRecordIds.mockResolvedValue(['1', '2']);
      const service = await buildService();
      await service.start(initMessage());
      expect(lock.acquire).toHaveBeenCalledWith(SESSION_LOCK_KEY, 90000);
      expect(site.buildListingPageUrl).toHaveBeenCalledWith(baseUrl, 0);
      expect(browser.newPage).toHaveBeenCalledWith({ kind: 'persistent' });
      expect(browser.scrollRandomly).toHaveBeenCalledWith(page, '#app');
      expect(site.extractRecordIds).toHaveBeenCalledWith(page, 'logged-in');
      expect(page.goto).toHaveBeenCalledTimes(1);
      expect(page.close).toHaveBeenCalledTimes(1);
      expect(storage.appendRawListingIds).toHaveBeenCalledWith('run-1', [
        '1',
        '2',
      ]);
      expect(queue.publishListingPage).toHaveBeenCalledTimes(1);
      const [published] = queue.publishListingPage.mock.calls[0];
      expect(published).toMatchObject({
        runId: 'run-1',
        baseUrl,
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        pagesVisited: 1,
        recordIds: ['1', '2'],
        lockToken: 'token-1',
      });
      expect(typeof published.scheduledAt).toBe('string');
      expect(dispatch.dispatch).not.toHaveBeenCalled();
      expect(lock.release).not.toHaveBeenCalled();
    });
    it('starts pagination from the given startPage (1-indexed) instead of the first page', async () => {
      site.extractRecordIds.mockResolvedValue(['1', '2']);
      const service = await buildService();
      await service.start(initMessage({ startPage: 3 }));
      expect(site.buildListingPageUrl).toHaveBeenCalledWith(baseUrl, 50);
      const [published] = queue.publishListingPage.mock.calls[0];
      expect(published).toMatchObject({ pagesVisited: 3 });
    });
    it('carries the recycle flag on every published page and into dispatch', async () => {
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(initMessage({ startPage: 1, recycle: true }));
      const [published] = queue.publishListingPage.mock.calls[0];
      expect(published).toMatchObject({ recycle: true });
      config.maxListingPages = 1;
      await service.start(
        initMessage({ runId: 'run-2', startPage: 1, recycle: true }),
      );
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-2', ['1'], {
        detailMode: 'logged-out',
        recycle: true,
      });
    });
    it('carries dispatchCount on every published page and into dispatch', async () => {
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(
        initMessage({ startPage: 1, recycle: false, dispatchCount: 5 }),
      );
      const [published] = queue.publishListingPage.mock.calls[0];
      expect(published).toMatchObject({ dispatchCount: 5 });
      config.maxListingPages = 1;
      await service.start(
        initMessage({
          runId: 'run-2',
          startPage: 1,
          recycle: false,
          dispatchCount: 5,
        }),
      );
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-2', ['1'], {
        detailMode: 'logged-out',
        recycle: false,
        dispatchCount: 5,
      });
    });
    it('dispatches and releases the lock immediately when the first page is already empty', async () => {
      site.extractRecordIds.mockResolvedValue([]);
      const service = await buildService();
      await service.start(initMessage());
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', [], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
      expect(queue.publishListingPage).not.toHaveBeenCalled();
    });
    it('stops pagination and dispatches once MAX_LISTING_PAGES would be reached', async () => {
      config.maxListingPages = 1;
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(initMessage());
      expect(queue.publishListingPage).not.toHaveBeenCalled();
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', ['1'], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('dispatches immediately without touching the browser when MAX_LISTING_PAGES is 0', async () => {
      config.maxListingPages = 0;
      const service = await buildService();
      await service.start(initMessage());
      expect(browser.newPage).not.toHaveBeenCalled();
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', [], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('closes the page and releases the lock if extraction throws', async () => {
      site.extractRecordIds.mockRejectedValue(new Error('boom'));
      const service = await buildService();
      await expect(service.start(initMessage())).rejects.toThrow('boom');
      expect(page.close).toHaveBeenCalledTimes(1);
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('waits lockBusyRequeueWaitMs, then requeues the init without throwing or touching the browser when the session lock is already held', async () => {
      lock.acquire.mockResolvedValue(null);
      const service = await buildService();
      vi.useFakeTimers();
      try {
        const done = service.start(
          initMessage({ startPage: 3, recycle: true }),
        );
        await vi.advanceTimersByTimeAsync(4999);
        expect(queue.publishListingInit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await expect(done).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: 'run-1',
        baseUrl,
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: 3,
        recycle: true,
      });
      expect(browser.newPage).not.toHaveBeenCalled();
      expect(lock.release).not.toHaveBeenCalled();
      expect(dispatch.dispatch).not.toHaveBeenCalled();
    });
    it('does not requeue the init when the session lock is acquired', async () => {
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(initMessage());
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
  });
  describe('start in logged-out listing mode', () => {
    it('reads only the first listing batch of the base url, in an ephemeral context, without paging, scrolling or clicking', async () => {
      site.extractRecordIds.mockResolvedValue(['1', '2']);
      const service = await buildService();
      await service.start(initMessage({ listingMode: 'logged-out' }));
      expect(browser.newPage).toHaveBeenCalledWith({ kind: 'ephemeral' });
      expect(page.goto).toHaveBeenCalledWith(baseUrl);
      expect(site.buildListingPageUrl).not.toHaveBeenCalled();
      expect(browser.scrollRandomly).not.toHaveBeenCalled();
      expect(site.extractRecordIds).toHaveBeenCalledWith(page, 'logged-out');
      expect(page.close).toHaveBeenCalledTimes(1);
      expect(storage.appendRawListingIds).toHaveBeenCalledWith('run-1', [
        '1',
        '2',
      ]);
      expect(queue.publishListingPage).not.toHaveBeenCalled();
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', ['1', '2'], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('carries the detail mode, recycle flag and dispatchCount into dispatch', async () => {
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(
        initMessage({
          listingMode: 'logged-out',
          detailMode: 'logged-in',
          recycle: true,
          dispatchCount: 4,
        }),
      );
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', ['1'], {
        detailMode: 'logged-in',
        recycle: true,
        dispatchCount: 4,
      });
    });
    it('ignores startPage and still reads the base url as given', async () => {
      site.extractRecordIds.mockResolvedValue(['1']);
      const service = await buildService();
      await service.start(
        initMessage({ listingMode: 'logged-out', startPage: 3 }),
      );
      expect(page.goto).toHaveBeenCalledWith(baseUrl);
      expect(site.buildListingPageUrl).not.toHaveBeenCalled();
    });
    it('dispatches nothing new and skips the raw listing file when the batch is empty', async () => {
      site.extractRecordIds.mockResolvedValue([]);
      const service = await buildService();
      await service.start(initMessage({ listingMode: 'logged-out' }));
      expect(storage.appendRawListingIds).not.toHaveBeenCalled();
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', [], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('closes the page and releases the lock if extraction throws', async () => {
      site.extractRecordIds.mockRejectedValue(new Error('boom'));
      const service = await buildService();
      await expect(
        service.start(initMessage({ listingMode: 'logged-out' })),
      ).rejects.toThrow('boom');
      expect(page.close).toHaveBeenCalledTimes(1);
      expect(dispatch.dispatch).not.toHaveBeenCalled();
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
  });
  describe('continuePage', () => {
    const baseMessage = {
      runId: 'run-1',
      baseUrl,
      listingMode: 'logged-in' as const,
      detailMode: 'logged-out' as const,
      pagesVisited: 1,
      recordIds: ['1', '2'],
      lockToken: 'token-1',
      scheduledAt: new Date(0).toISOString(),
    };
    async function runContinuePage(
      service: ListingCrawlerService,
      message: typeof baseMessage & { recycle?: boolean },
    ): Promise<void> {
      vi.useFakeTimers();
      const done = service.continuePage(message);
      done.catch(() => {});
      try {
        await vi.runAllTimersAsync();
        await done;
      } finally {
        vi.useRealTimers();
      }
    }
    it('waits delayForPage(pagesVisited) freshly rolled from Date.now(), not message.scheduledAt, before renewing the lock', async () => {
      site.extractRecordIds.mockResolvedValue(['3']);
      const service = await buildService();
      vi.useFakeTimers();
      const done = service.continuePage(baseMessage);
      await vi.advanceTimersByTimeAsync(3140);
      expect(lock.extend).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);
      await vi.runAllTimersAsync();
      await done;
      expect(lock.extend).toHaveBeenCalled();
      vi.useRealTimers();
    });
    it('renews the lock, fetches the page, and publishes the next one', async () => {
      site.extractRecordIds.mockResolvedValue(['3']);
      const service = await buildService();
      await runContinuePage(service, baseMessage);
      expect(lock.extend).toHaveBeenNthCalledWith(
        1,
        SESSION_LOCK_KEY,
        'token-1',
        90000,
      );
      const secondExtendCall = lock.extend.mock.calls[1];
      expect(Number.isInteger(secondExtendCall[2])).toBe(true);
      expect(site.buildListingPageUrl).toHaveBeenCalledWith(baseUrl, 25);
      expect(storage.appendRawListingIds).toHaveBeenCalledWith('run-1', ['3']);
      const [published] = queue.publishListingPage.mock.calls[0];
      expect(published).toMatchObject({
        runId: 'run-1',
        baseUrl,
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        pagesVisited: 2,
        recordIds: ['1', '2', '3'],
        lockToken: 'token-1',
      });
    });
    it('dispatches and releases the lock on an empty page', async () => {
      site.extractRecordIds.mockResolvedValue([]);
      const service = await buildService();
      await runContinuePage(service, baseMessage);
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', ['1', '2'], {
        detailMode: 'logged-out',
        recycle: false,
      });
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('dispatches with the recycle flag carried by the page message', async () => {
      site.extractRecordIds.mockResolvedValue([]);
      const service = await buildService();
      await runContinuePage(service, { ...baseMessage, recycle: true });
      expect(dispatch.dispatch).toHaveBeenCalledWith('run-1', ['1', '2'], {
        detailMode: 'logged-out',
        recycle: true,
      });
    });
    it('throws without touching the browser when the lock was lost between pages', async () => {
      lock.extend.mockResolvedValue(false);
      const service = await buildService();
      await expect(runContinuePage(service, baseMessage)).rejects.toThrow();
      expect(browser.newPage).not.toHaveBeenCalled();
      expect(lock.release).not.toHaveBeenCalled();
    });
    it('releases the lock and throws when it is lost while extending mid-crawl (after fetching a non-empty page)', async () => {
      site.extractRecordIds.mockResolvedValue(['3']);
      lock.extend.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const service = await buildService();
      await expect(runContinuePage(service, baseMessage)).rejects.toThrow(
        /lost the site session lock mid-crawl/i,
      );
      expect(queue.publishListingPage).not.toHaveBeenCalled();
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('releases the lock if extraction throws mid-crawl', async () => {
      site.extractRecordIds.mockRejectedValue(new Error('boom'));
      const service = await buildService();
      await expect(runContinuePage(service, baseMessage)).rejects.toThrow(
        'boom',
      );
      expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    });
    it('processes immediately even when scheduledAt is far in the future (no longer waited on)', async () => {
      site.extractRecordIds.mockResolvedValue(['3']);
      const futureMessage = {
        ...baseMessage,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
      const service = await buildService();
      await runContinuePage(service, futureMessage);
      expect(lock.extend).toHaveBeenCalled();
    });
  });
});
