import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
describe('ExpiredReprocessService', () => {
  let storage: {
    readExpiredRecordIds: ReturnType<typeof vi.fn>;
  };
  let queue: {
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<ExpiredReprocessService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpiredReprocessService,
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    return module.get<ExpiredReprocessService>(ExpiredReprocessService);
  }
  beforeEach(() => {
    storage = {
      readExpiredRecordIds: vi.fn().mockResolvedValue([]),
    };
    queue = { publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined) };
  });
  it('reads scraped_records_expired.txt, stamps a shared scheduledAt, and publishes each record under the given runId and detail mode', async () => {
    storage.readExpiredRecordIds.mockResolvedValue(['1', '2']);
    const service = await buildService();
    const result = await service.run('run-1', 'logged-in');
    expect(result.reprocessed).toEqual(['1', '2']);
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
    expect(published[0].scheduledAt).toBe(published[1].scheduledAt);
    expect(published).toEqual([
      {
        recordId: '1',
        scheduledAt: published[0].scheduledAt,
        runId: 'run-1',
        detailMode: 'logged-in',
      },
      {
        recordId: '2',
        scheduledAt: published[1].scheduledAt,
        runId: 'run-1',
        detailMode: 'logged-in',
      },
    ]);
  });
  it('publishes nothing when there are no expired records', async () => {
    const service = await buildService();
    const result = await service.run('run-1', 'logged-in');
    expect(result).toEqual({ reprocessed: [] });
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
  });
});
