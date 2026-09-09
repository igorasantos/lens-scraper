import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
describe('RecordTitlesExtractService', () => {
  let storage: {
    listRecordDetailHtmlFiles: ReturnType<typeof vi.fn>;
    resetRawRecordTitlesFile: ReturnType<typeof vi.fn>;
  };
  let queue: {
    publishRecordTitleExtractsBatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordTitlesExtractService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordTitlesExtractService,
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    return module.get<RecordTitlesExtractService>(RecordTitlesExtractService);
  }
  beforeEach(() => {
    storage = {
      listRecordDetailHtmlFiles: vi.fn().mockResolvedValue([]),
      resetRawRecordTitlesFile: vi.fn().mockResolvedValue(undefined),
    };
    queue = {
      publishRecordTitleExtractsBatch: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('resets the output file and dispatches nothing when there are no record html files', async () => {
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ filesScanned: 0 });
    expect(storage.resetRawRecordTitlesFile).toHaveBeenCalled();
    expect(queue.publishRecordTitleExtractsBatch).toHaveBeenCalledWith([]);
  });
  it('dispatches one RecordTitleExtractMessage per file found on disk', async () => {
    storage.listRecordDetailHtmlFiles.mockResolvedValue([
      '/data/records_en/111.html',
      '/data/records_fr/222.html',
    ]);
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ filesScanned: 2 });
    expect(storage.resetRawRecordTitlesFile).toHaveBeenCalled();
    expect(queue.publishRecordTitleExtractsBatch).toHaveBeenCalledWith([
      { runId: 'run-1', fileKey: '/data/records_en/111.html' },
      { runId: 'run-1', fileKey: '/data/records_fr/222.html' },
    ]);
  });
  it('resets the output file before dispatching', async () => {
    storage.listRecordDetailHtmlFiles.mockResolvedValue([
      '/data/records_en/111.html',
    ]);
    const calls: string[] = [];
    storage.resetRawRecordTitlesFile.mockImplementation(async () => {
      calls.push('reset');
    });
    queue.publishRecordTitleExtractsBatch.mockImplementation(async () => {
      calls.push('publish');
    });
    const service = await buildService();
    await service.run('run-1');
    expect(calls).toEqual(['reset', 'publish']);
  });
});
