import { Test, TestingModule } from '@nestjs/testing';
import { DeadLetterService, StorageService } from '@app/storage';
import { RecordsFilterService } from './records-filter.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
import { FilterController } from './filter.controller.js';
describe('FilterController', () => {
  let deadLetter: {
    run: ReturnType<typeof vi.fn>;
  };
  let filterController: FilterController;
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
    recordsFilter = {
      run: vi.fn().mockResolvedValue({ filesScanned: 2 }),
    };
    recordFilterCopy = { run: vi.fn().mockResolvedValue(undefined) };
    recordLanguageClassify = { run: vi.fn().mockResolvedValue(undefined) };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [FilterController],
      providers: [
        { provide: RecordsFilterService, useValue: recordsFilter },
        { provide: RecordFilterCopyService, useValue: recordFilterCopy },
        {
          provide: RecordLanguageClassifyService,
          useValue: recordLanguageClassify,
        },
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
    filterController = app.get<FilterController>(FilterController);
  });
  describe('handleRecordsFilter', () => {
    it('delegates to RecordsFilterService', async () => {
      const message = { runId: 'run-7' };
      await filterController.handleRecordsFilter(message);
      expect(recordsFilter.run).toHaveBeenCalledWith('run-7');
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.records.filter',
        { runId: 'run-7' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleRecordFilterCopy', () => {
    it('delegates to RecordFilterCopyService', async () => {
      const message = {
        runId: 'run-7',
        fileKey: '/data/1_records_raw/en/111.html',
      };
      await filterController.handleRecordFilterCopy(message);
      expect(recordFilterCopy.run).toHaveBeenCalledWith(message);
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.record.filter.copy',
        { runId: 'run-7', recordId: '111' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleRecordLanguageClassify', () => {
    it('delegates to RecordLanguageClassifyService', async () => {
      const message = { runId: 'run-8', recordId: '123' };
      await filterController.handleRecordLanguageClassify(message);
      expect(recordLanguageClassify.run).toHaveBeenCalledWith(message);
      expect(deadLetter.run).toHaveBeenCalledWith(
        'scrape.record.language.classify',
        { runId: 'run-8', recordId: '123' },
        message,
        expect.any(Function),
      );
    });
  });
});
