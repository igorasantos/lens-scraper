import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { XxReprocessService } from './xx-reprocess.service.js';
describe('XxReprocessService', () => {
  let storage: {
    readUnknownLanguageRecordIds: ReturnType<typeof vi.fn>;
  };
  let queue: {
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<XxReprocessService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XxReprocessService,
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    return module.get<XxReprocessService>(XxReprocessService);
  }
  beforeEach(() => {
    storage = {
      readUnknownLanguageRecordIds: vi.fn().mockResolvedValue([]),
    };
    queue = { publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined) };
  });
  it('reads records_xx.txt, stamps a shared scheduledAt, and publishes each record under the given runId', async () => {
    storage.readUnknownLanguageRecordIds.mockResolvedValue(['1', '2']);
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result.reprocessed).toEqual(['1', '2']);
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
    expect(published[0].scheduledAt).toBe(published[1].scheduledAt);
    expect(published).toEqual([
      { recordId: '1', scheduledAt: published[0].scheduledAt, runId: 'run-1' },
      { recordId: '2', scheduledAt: published[1].scheduledAt, runId: 'run-1' },
    ]);
  });
  it('publishes nothing when there are no records_xx.txt records', async () => {
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ reprocessed: [] });
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
  });
});
