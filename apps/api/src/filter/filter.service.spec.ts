import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { FilterService } from './filter.service.js';
describe('FilterService', () => {
  let queue: {
    publishRecordsFilter: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<FilterService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilterService, { provide: QueueService, useValue: queue }],
    }).compile();
    return module.get<FilterService>(FilterService);
  }
  beforeEach(() => {
    queue = {
      publishRecordsFilter: vi.fn().mockResolvedValue(undefined),
    };
  });
  describe('filterRecords', () => {
    it('publishes a records filter message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.filterRecords();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordsFilter).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.filterRecords();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
