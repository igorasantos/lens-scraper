import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { DetailService } from './detail.service.js';
describe('DetailService', () => {
  let queue: {
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishExpiredReprocess: ReturnType<typeof vi.fn>;
    publishXxReprocess: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<DetailService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DetailService, { provide: QueueService, useValue: queue }],
    }).compile();
    return module.get<DetailService>(DetailService);
  }
  beforeEach(() => {
    queue = {
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishExpiredReprocess: vi.fn().mockResolvedValue(undefined),
      publishXxReprocess: vi.fn().mockResolvedValue(undefined),
    };
  });
  describe('queueRecordDetails', () => {
    it('publishes a single record detail message stamped with the dispatch scheduledAt', async () => {
      const service = await buildService();
      const [result] = await service.queueRecordDetails(['123']);
      expect(result.recordId).toBe('123');
      expect(result.status).toBe('queued');
      expect(typeof result.scheduledAt).toBe('string');
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        { recordId: '123', scheduledAt: result.scheduledAt },
      ]);
    });
    it('publishes one message per record id, all sharing the same scheduledAt', async () => {
      const service = await buildService();
      const results = await service.queueRecordDetails(['123', '456']);
      expect(results.map((r) => r.recordId)).toEqual(['123', '456']);
      expect(results[0].scheduledAt).toBe(results[1].scheduledAt);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        { recordId: '123', scheduledAt: results[0].scheduledAt },
        { recordId: '456', scheduledAt: results[1].scheduledAt },
      ]);
    });
    it('stamps scheduledAt as the current dispatch time, not a future offset', async () => {
      const before = Date.now();
      const service = await buildService();
      const [result] = await service.queueRecordDetails(['123']);
      const after = Date.now();
      const scheduledAtMs = new Date(result.scheduledAt).getTime();
      expect(scheduledAtMs).toBeGreaterThanOrEqual(before);
      expect(scheduledAtMs).toBeLessThanOrEqual(after);
    });
    it('throws and does not publish when the list is empty', async () => {
      const service = await buildService();
      await expect(service.queueRecordDetails([])).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
    it('throws and does not publish when a recordId is not numeric', async () => {
      const service = await buildService();
      await expect(service.queueRecordDetails(['123', 'abc'])).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
  });
  describe('reprocessExpiredRecords', () => {
    it('publishes an expired reprocess message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.reprocessExpiredRecords();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishExpiredReprocess).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.reprocessExpiredRecords();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('reprocessXxRecords', () => {
    it('publishes an xx reprocess message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.reprocessXxRecords();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishXxReprocess).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.reprocessXxRecords();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
