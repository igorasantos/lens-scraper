import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { RecordsFilterService } from './records-filter.service.js';
describe('RecordsFilterService', () => {
  let storage: {
    listRecordDetailHtmlFiles: ReturnType<typeof vi.fn>;
  };
  let queue: {
    publishRecordFilterCopiesBatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordsFilterService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsFilterService,
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    return module.get<RecordsFilterService>(RecordsFilterService);
  }
  beforeEach(() => {
    storage = {
      listRecordDetailHtmlFiles: vi.fn().mockResolvedValue([]),
    };
    queue = {
      publishRecordFilterCopiesBatch: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('dispatches nothing when there are no record html files', async () => {
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ filesScanned: 0 });
    expect(queue.publishRecordFilterCopiesBatch).toHaveBeenCalledWith([]);
  });
  it('dispatches one RecordFilterCopyMessage per file found on disk', async () => {
    storage.listRecordDetailHtmlFiles.mockResolvedValue([
      '/data/1_records_raw/en/111.html',
      '/data/1_records_raw/expired/222.html',
    ]);
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ filesScanned: 2 });
    expect(queue.publishRecordFilterCopiesBatch).toHaveBeenCalledWith([
      { runId: 'run-1', fileKey: '/data/1_records_raw/en/111.html' },
      { runId: 'run-1', fileKey: '/data/1_records_raw/expired/222.html' },
    ]);
  });
});
