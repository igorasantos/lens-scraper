import { Test, TestingModule } from '@nestjs/testing';
import { HandlerRetryService } from '@app/storage';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { RecordsRecycleService } from './records-recycle.service.js';
import { ListingController } from './listing.controller.js';
describe('ListingController', () => {
  let handlerRetry: {
    runOrDeadLetter: ReturnType<typeof vi.fn>;
  };
  let listingController: ListingController;
  let listingCrawler: {
    start: ReturnType<typeof vi.fn>;
    continuePage: ReturnType<typeof vi.fn>;
  };
  let pendingReprocess: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordsRecycle: {
    run: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    handlerRetry = {
      runOrDeadLetter: vi.fn(
        (
          _topic: string,
          _target: unknown,
          _payload: unknown,
          handle: () => Promise<void>,
        ) => handle(),
      ),
    };
    listingCrawler = {
      start: vi.fn().mockResolvedValue(undefined),
      continuePage: vi.fn().mockResolvedValue(undefined),
    };
    pendingReprocess = {
      run: vi.fn().mockResolvedValue({
        dispatched: ['1', '2'],
        skipped: [],
      }),
    };
    recordsRecycle = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ListingController],
      providers: [
        { provide: ListingCrawlerService, useValue: listingCrawler },
        { provide: PendingReprocessService, useValue: pendingReprocess },
        { provide: RecordsRecycleService, useValue: recordsRecycle },
        { provide: HandlerRetryService, useValue: handlerRetry },
      ],
    }).compile();
    listingController = app.get<ListingController>(ListingController);
  });
  describe('handleListingInit', () => {
    it('delegates the whole message to ListingCrawlerService.start', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        listingMode: 'logged-out' as const,
        detailMode: 'logged-in' as const,
      };
      await listingController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(message);
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.listing.init',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
    it('passes startPage, recycle and dispatchCount through with the message', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        listingMode: 'logged-in' as const,
        detailMode: 'logged-out' as const,
        startPage: 3,
        recycle: true,
        dispatchCount: 5,
      };
      await listingController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(message);
    });
  });
  describe('handleListingPage', () => {
    it('delegates to ListingCrawlerService.continuePage', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        listingMode: 'logged-in' as const,
        detailMode: 'logged-out' as const,
        pagesVisited: 1,
        recordIds: ['1'],
        lockToken: 'token-1',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      };
      await listingController.handleListingPage(message);
      expect(listingCrawler.continuePage).toHaveBeenCalledWith(message);
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.listing.page',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handlePendingReprocess', () => {
    it('delegates to PendingReprocessService', async () => {
      const message = {
        runId: 'run-2',
        fromRunId: 'run-1',
        detailMode: 'logged-out' as const,
      };
      await listingController.handlePendingReprocess(message);
      expect(pendingReprocess.run).toHaveBeenCalledWith('run-2', 'run-1', {
        detailMode: 'logged-out',
        recycle: undefined,
        dispatchCount: undefined,
      });
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.records.pending.reprocess',
        { runId: 'run-2' },
        message,
        expect.any(Function),
      );
    });
    it('passes recycle through to PendingReprocessService', async () => {
      const message = {
        runId: 'run-2',
        fromRunId: 'run-1',
        detailMode: 'logged-in' as const,
        recycle: true,
      };
      await listingController.handlePendingReprocess(message);
      expect(pendingReprocess.run).toHaveBeenCalledWith('run-2', 'run-1', {
        detailMode: 'logged-in',
        recycle: true,
      });
    });
    it('passes dispatchCount through to PendingReprocessService', async () => {
      const message = {
        runId: 'run-2',
        fromRunId: 'run-1',
        detailMode: 'logged-out' as const,
        dispatchCount: 5,
      };
      await listingController.handlePendingReprocess(message);
      expect(pendingReprocess.run).toHaveBeenCalledWith('run-2', 'run-1', {
        detailMode: 'logged-out',
        dispatchCount: 5,
      });
    });
  });
  describe('handleRecordsRecycle', () => {
    it('passes the detail mode and dispatchCount through to RecordsRecycleService', async () => {
      await listingController.handleRecordsRecycle({
        runId: 'run-1',
        detailMode: 'logged-in',
        dispatchCount: 5,
      });
      expect(recordsRecycle.run).toHaveBeenCalledWith('run-1', {
        detailMode: 'logged-in',
        dispatchCount: 5,
      });
    });
    it('delegates to RecordsRecycleService', async () => {
      const message = { runId: 'run-1', detailMode: 'logged-out' as const };
      await listingController.handleRecordsRecycle(message);
      expect(recordsRecycle.run).toHaveBeenCalledWith('run-1', {
        detailMode: 'logged-out',
      });
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.records.recycle',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
  });
});
