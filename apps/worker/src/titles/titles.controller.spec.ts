import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { DeadLetterService, QUEUE_PORT } from '@app/queue';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
import { TitlesController } from './titles.controller.js';
describe('TitlesController', () => {
  let titlesController: TitlesController;
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
  beforeEach(async () => {
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
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TitlesController],
      providers: [
        { provide: RecordTitlesExtractService, useValue: recordTitlesExtract },
        { provide: RecordTitleExtractService, useValue: recordTitleExtract },
        {
          provide: RecordTitlesDedupSortService,
          useValue: recordTitlesDedupSort,
        },
        { provide: RecordTitlesFilterService, useValue: recordTitlesFilter },
        DeadLetterService,
        { provide: QUEUE_PORT, useValue: { publish: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { kafkaHandlerMaxAttempts: 3, kafkaHandlerRetryBaseMs: 1 },
        },
      ],
    }).compile();
    titlesController = app.get<TitlesController>(TitlesController);
  });
  describe('handleRecordTitlesExtract', () => {
    it('delegates to RecordTitlesExtractService', async () => {
      const message = { runId: 'run-4' };
      await titlesController.handleRecordTitlesExtract(message);
      expect(recordTitlesExtract.run).toHaveBeenCalledWith('run-4');
    });
  });
  describe('handleRecordTitleExtract', () => {
    it('delegates to RecordTitleExtractService', async () => {
      const message = { runId: 'run-4', fileKey: '/data/records_en/111.html' };
      await titlesController.handleRecordTitleExtract(message);
      expect(recordTitleExtract.run).toHaveBeenCalledWith(message);
    });
  });
  describe('handleRecordTitlesDedupSort', () => {
    it('delegates to RecordTitlesDedupSortService', async () => {
      const message = { runId: 'run-5' };
      await titlesController.handleRecordTitlesDedupSort(message);
      expect(recordTitlesDedupSort.run).toHaveBeenCalledWith('run-5');
    });
  });
  describe('handleRecordTitlesFilter', () => {
    it('delegates to RecordTitlesFilterService', async () => {
      const message = { runId: 'run-6', substrings: ['laptop'] };
      await titlesController.handleRecordTitlesFilter(message);
      expect(recordTitlesFilter.run).toHaveBeenCalledWith('run-6', ['laptop']);
    });
  });
});
