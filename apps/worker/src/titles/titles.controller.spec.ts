import { Test, TestingModule } from '@nestjs/testing';
import { DeadLetterService, StorageService } from '@app/storage';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
import { TitlesController } from './titles.controller.js';
describe('TitlesController', () => {
  let deadLetter: {
    run: ReturnType<typeof vi.fn>;
  };
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
        { provide: DeadLetterService, useValue: deadLetter },
        {
          provide: StorageService,
          useValue: {
            recordIdFromDetailKey: (key: string) =>
              key
                .split('/')
                .pop()
                ?.replace(/\.html$/, ''),
          },
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
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.records.titles.extract',
        { runId: 'run-4' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleRecordTitleExtract', () => {
    it('delegates to RecordTitleExtractService', async () => {
      const message = { runId: 'run-4', fileKey: '/data/records_en/111.html' };
      await titlesController.handleRecordTitleExtract(message);
      expect(recordTitleExtract.run).toHaveBeenCalledWith(message);
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.record.title.extract',
        { runId: 'run-4', recordId: '111' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleRecordTitlesDedupSort', () => {
    it('delegates to RecordTitlesDedupSortService', async () => {
      const message = { runId: 'run-5' };
      await titlesController.handleRecordTitlesDedupSort(message);
      expect(recordTitlesDedupSort.run).toHaveBeenCalledWith('run-5');
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.record.titles.dedup-sort',
        { runId: 'run-5' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleRecordTitlesFilter', () => {
    it('delegates to RecordTitlesFilterService', async () => {
      const message = { runId: 'run-6', substrings: ['laptop'] };
      await titlesController.handleRecordTitlesFilter(message);
      expect(recordTitlesFilter.run).toHaveBeenCalledWith('run-6', ['laptop']);
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.record.titles.filter',
        { runId: 'run-6' },
        message,
        expect.any(Function),
      );
    });
  });
});
