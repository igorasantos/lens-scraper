import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { DeadLetterService, QUEUE_PORT } from '@app/queue';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
import { RecordsFilterService } from './records-filter.service.js';
import { ListingContinueService } from './listing-continue.service.js';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { WorkerController } from './worker.controller.js';
describe('WorkerController', () => {
  let workerController: WorkerController;
  let detailScraper: {
    handle: ReturnType<typeof vi.fn>;
  };
  let listingCrawler: {
    start: ReturnType<typeof vi.fn>;
    continuePage: ReturnType<typeof vi.fn>;
  };
  let listingContinue: {
    run: ReturnType<typeof vi.fn>;
  };
  let expiredReprocess: {
    run: ReturnType<typeof vi.fn>;
  };
  let xxReprocess: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordTitlesExtract: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordTitleExtract: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordTitlesDedupSort: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordTitlesFilter: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordsFilter: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordFilterCopy: {
    run: ReturnType<typeof vi.fn>;
  };
  let recordLanguageClassify: {
    run: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    detailScraper = { handle: vi.fn().mockResolvedValue(undefined) };
    listingCrawler = {
      start: vi.fn().mockResolvedValue(undefined),
      continuePage: vi.fn().mockResolvedValue(undefined),
    };
    listingContinue = {
      run: vi.fn().mockResolvedValue({
        dispatched: ['1', '2'],
        skipped: [],
      }),
    };
    expiredReprocess = {
      run: vi.fn().mockResolvedValue({ reprocessed: ['1', '2'] }),
    };
    xxReprocess = {
      run: vi.fn().mockResolvedValue({ reprocessed: ['3', '4'] }),
    };
    recordTitlesExtract = {
      run: vi.fn().mockResolvedValue({ filesScanned: 2 }),
    };
    recordTitleExtract = { run: vi.fn().mockResolvedValue(undefined) };
    recordTitlesDedupSort = {
      run: vi.fn().mockResolvedValue({ titleCount: 2 }),
    };
    recordTitlesFilter = {
      run: vi.fn().mockResolvedValue({ titleCount: 1 }),
    };
    recordsFilter = {
      run: vi.fn().mockResolvedValue({ filesScanned: 2 }),
    };
    recordFilterCopy = { run: vi.fn().mockResolvedValue(undefined) };
    recordLanguageClassify = { run: vi.fn().mockResolvedValue(undefined) };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkerController],
      providers: [
        { provide: DetailScraperService, useValue: detailScraper },
        { provide: ListingCrawlerService, useValue: listingCrawler },
        { provide: ListingContinueService, useValue: listingContinue },
        { provide: ExpiredReprocessService, useValue: expiredReprocess },
        { provide: XxReprocessService, useValue: xxReprocess },
        { provide: RecordTitlesExtractService, useValue: recordTitlesExtract },
        { provide: RecordTitleExtractService, useValue: recordTitleExtract },
        {
          provide: RecordTitlesDedupSortService,
          useValue: recordTitlesDedupSort,
        },
        { provide: RecordTitlesFilterService, useValue: recordTitlesFilter },
        { provide: RecordsFilterService, useValue: recordsFilter },
        { provide: RecordFilterCopyService, useValue: recordFilterCopy },
        {
          provide: RecordLanguageClassifyService,
          useValue: recordLanguageClassify,
        },
        DeadLetterService,
        { provide: QUEUE_PORT, useValue: { publish: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { kafkaHandlerMaxAttempts: 3, kafkaHandlerRetryBaseMs: 1 },
        },
      ],
    }).compile();
    workerController = app.get<WorkerController>(WorkerController);
  });
  describe('handleRecordDetail', () => {
    it('delegates to DetailScraperService', async () => {
      const message = {
        recordId: '123',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      };
      await workerController.handleRecordDetail(message);
      expect(detailScraper.handle).toHaveBeenCalledWith(message);
    });
  });
  describe('handleListingInit', () => {
    it('delegates to ListingCrawlerService.start', async () => {
      const message = { runId: 'run-1', baseUrl: 'https://example.com' };
      await workerController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(
        'run-1',
        'https://example.com',
        undefined,
      );
    });
    it('passes startPage through to ListingCrawlerService.start', async () => {
      const message = {
        runId: 'run-1',
        baseUrl: 'https://example.com',
        startPage: 3,
      };
      await workerController.handleListingInit(message);
      expect(listingCrawler.start).toHaveBeenCalledWith(
        'run-1',
        'https://example.com',
        3,
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
      await workerController.handleListingPage(message);
      expect(listingCrawler.continuePage).toHaveBeenCalledWith(message);
    });
  });
  describe('handleListingContinue', () => {
    it('delegates to ListingContinueService', async () => {
      const message = { runId: 'run-2', fromRunId: 'run-1' };
      await workerController.handleListingContinue(message);
      expect(listingContinue.run).toHaveBeenCalledWith('run-2', 'run-1');
    });
  });
  describe('handleExpiredReprocess', () => {
    it('delegates to ExpiredReprocessService', async () => {
      const message = { runId: 'run-3' };
      await workerController.handleExpiredReprocess(message);
      expect(expiredReprocess.run).toHaveBeenCalledWith('run-3');
    });
  });
  describe('handleXxReprocess', () => {
    it('delegates to XxReprocessService', async () => {
      const message = { runId: 'run-3b' };
      await workerController.handleXxReprocess(message);
      expect(xxReprocess.run).toHaveBeenCalledWith('run-3b');
    });
  });
  describe('handleRecordTitlesExtract', () => {
    it('delegates to RecordTitlesExtractService', async () => {
      const message = { runId: 'run-4' };
      await workerController.handleRecordTitlesExtract(message);
      expect(recordTitlesExtract.run).toHaveBeenCalledWith('run-4');
    });
  });
  describe('handleRecordTitleExtract', () => {
    it('delegates to RecordTitleExtractService', async () => {
      const message = { runId: 'run-4', fileKey: '/data/records_en/111.html' };
      await workerController.handleRecordTitleExtract(message);
      expect(recordTitleExtract.run).toHaveBeenCalledWith(message);
    });
  });
  describe('handleRecordTitlesDedupSort', () => {
    it('delegates to RecordTitlesDedupSortService', async () => {
      const message = { runId: 'run-5' };
      await workerController.handleRecordTitlesDedupSort(message);
      expect(recordTitlesDedupSort.run).toHaveBeenCalledWith('run-5');
    });
  });
  describe('handleRecordTitlesFilter', () => {
    it('delegates to RecordTitlesFilterService', async () => {
      const message = { runId: 'run-6', substrings: ['laptop'] };
      await workerController.handleRecordTitlesFilter(message);
      expect(recordTitlesFilter.run).toHaveBeenCalledWith('run-6', ['laptop']);
    });
  });
  describe('handleRecordsFilter', () => {
    it('delegates to RecordsFilterService', async () => {
      const message = { runId: 'run-7' };
      await workerController.handleRecordsFilter(message);
      expect(recordsFilter.run).toHaveBeenCalledWith('run-7');
    });
  });
  describe('handleRecordFilterCopy', () => {
    it('delegates to RecordFilterCopyService', async () => {
      const message = {
        runId: 'run-7',
        fileKey: '/data/1_records_raw/en/111.html',
      };
      await workerController.handleRecordFilterCopy(message);
      expect(recordFilterCopy.run).toHaveBeenCalledWith(message);
    });
  });
  describe('handleRecordLanguageClassify', () => {
    it('delegates to RecordLanguageClassifyService', async () => {
      const message = { runId: 'run-8', recordId: '123' };
      await workerController.handleRecordLanguageClassify(message);
      expect(recordLanguageClassify.run).toHaveBeenCalledWith(message);
    });
  });
});
