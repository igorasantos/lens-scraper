import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { DeadLetterService, QUEUE_PORT } from '@app/queue';
import { RecordsFilterService } from './records-filter.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
import { FilterController } from './filter.controller.js';
describe('FilterController', () => {
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
        DeadLetterService,
        { provide: QUEUE_PORT, useValue: { publish: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { kafkaHandlerMaxAttempts: 3, kafkaHandlerRetryBaseMs: 1 },
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
    });
  });
  describe('handleRecordLanguageClassify', () => {
    it('delegates to RecordLanguageClassifyService', async () => {
      const message = { runId: 'run-8', recordId: '123' };
      await filterController.handleRecordLanguageClassify(message);
      expect(recordLanguageClassify.run).toHaveBeenCalledWith(message);
    });
  });
});
