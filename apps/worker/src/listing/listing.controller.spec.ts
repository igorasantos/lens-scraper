import { Test, TestingModule } from '@nestjs/testing';
import { DeadLetterService } from '@app/storage';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { RecordsRecycleService } from './records-recycle.service.js';
import { ListingController } from './listing.controller.js';
describe('ListingController', () => {
  let deadLetter: {
    run: ReturnType<typeof vi.fn>;
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
    deadLetter = {
      run: vi.fn(
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
        { provide: DeadLetterService, useValue: deadLetter },
      ],
    }).compile();
    listingController = app.get<ListingController>(ListingController);
  });
  describe('handleListingInit', () => {
    it('delegates to ListingCrawlerService.start', async () => {
      const message = { runId: 'run-1', baseUrl: 'https://example.com' };
      await listingController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(
        'run-1',
        'https://example.com',
        undefined,
        undefined,
      );
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.listing.init',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
    it('passes startPage through to ListingCrawlerService.start', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        startPage: 3,
      };
      await listingController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(
        'run-1',
        'https://example.com',
        3,
        undefined,
      );
    });
    it('passes recycle through to ListingCrawlerService.start', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        recycle: true,
      };
      await listingController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(
        'run-1',
        'https://example.com',
        undefined,
        true,
      );
    });
  });
  describe('handleListingPage', () => {
    it('delegates to ListingCrawlerService.continuePage', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        pagesVisited: 1,
        recordIds: ['1'],
        lockToken: 'token-1',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      };
      await listingController.handleListingPage(message);
      expect(listingCrawler.continuePage).toHaveBeenCalledWith(message);
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.listing.page',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handlePendingReprocess', () => {
    it('delegates to PendingReprocessService', async () => {
      const message = { runId: 'run-2', fromRunId: 'run-1' };
      await listingController.handlePendingReprocess(message);
      expect(pendingReprocess.run).toHaveBeenCalledWith(
        'run-2',
        'run-1',
        undefined,
      );
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.records.pending.reprocess',
        { runId: 'run-2' },
        message,
        expect.any(Function),
      );
    });
    it('passes recycle through to PendingReprocessService', async () => {
      const message = { runId: 'run-2', fromRunId: 'run-1', recycle: true };
      await listingController.handlePendingReprocess(message);
      expect(pendingReprocess.run).toHaveBeenCalledWith('run-2', 'run-1', true);
    });
  });
  describe('handleRecordsRecycle', () => {
    it('delegates to RecordsRecycleService', async () => {
      const message = { runId: 'run-1' };
      await listingController.handleRecordsRecycle(message);
      expect(recordsRecycle.run).toHaveBeenCalledWith('run-1');
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.records.recycle',
        { runId: 'run-1' },
        message,
        expect.any(Function),
      );
    });
  });
});
