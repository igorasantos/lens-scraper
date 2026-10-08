import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { DetailService } from './detail.service.js';
import type { RecordDetailsRequestDto } from './dto/record-details-request.dto.js';
describe('DetailService', () => {
  let queue: {
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishExpiredReprocess: ReturnType<typeof vi.fn>;
    publishXxReprocess: ReturnType<typeof vi.fn>;
  };
  let storage: {
    readRecordIds: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<DetailService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailService,
        { provide: QueueService, useValue: queue },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<DetailService>(DetailService);
  }
  beforeEach(() => {
    queue = {
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishExpiredReprocess: vi.fn().mockResolvedValue(undefined),
      publishXxReprocess: vi.fn().mockResolvedValue(undefined),
    };
    storage = {
      readRecordIds: vi.fn().mockResolvedValue(new Set()),
    };
  });
  describe('queueRecordDetails', () => {
    function request(recordIds: string[]): RecordDetailsRequestDto {
      return { detail_mode: 'logged-out', records_to_reprocess: recordIds };
    }
    it('stamps the requested detail mode on every published message', async () => {
      const service = await buildService();
      await service.queueRecordDetails({
        detail_mode: 'logged-in',
        records_to_reprocess: ['123'],
      });
      const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
      expect(published).toEqual([
        expect.objectContaining({ recordId: '123', detailMode: 'logged-in' }),
      ]);
    });
    it('publishes a single record detail message stamped with the dispatch scheduledAt', async () => {
      const service = await buildService();
      const [result] = await service.queueRecordDetails(request(['123']));
      expect(result.recordId).toBe('123');
      expect(result.status).toBe('queued');
      expect(typeof result.scheduledAt).toBe('string');
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        {
          recordId: '123',
          scheduledAt: result.scheduledAt,
          detailMode: 'logged-out',
        },
      ]);
    });
    it('publishes one message per record id, all sharing the same scheduledAt', async () => {
      const service = await buildService();
      const results = await service.queueRecordDetails(request(['123', '456']));
      expect(results.map((r) => r.recordId)).toEqual(['123', '456']);
      expect(results[0].scheduledAt).toBe(results[1].scheduledAt);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        {
          recordId: '123',
          scheduledAt: results[0].scheduledAt,
          detailMode: 'logged-out',
        },
        {
          recordId: '456',
          scheduledAt: results[1].scheduledAt,
          detailMode: 'logged-out',
        },
      ]);
    });
    it('drops duplicate record ids before publishing, keeping first-seen order', async () => {
      const service = await buildService();
      const results = await service.queueRecordDetails(
        request(['123', '456', '123', '456', '789']),
      );
      expect(results.map((r) => r.recordId)).toEqual(['123', '456', '789']);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        {
          recordId: '123',
          scheduledAt: results[0].scheduledAt,
          detailMode: 'logged-out',
        },
        {
          recordId: '456',
          scheduledAt: results[0].scheduledAt,
          detailMode: 'logged-out',
        },
        {
          recordId: '789',
          scheduledAt: results[0].scheduledAt,
          detailMode: 'logged-out',
        },
      ]);
    });
    it('skips record ids already in a scraped records control file (any language bucket, xx included)', async () => {
      storage.readRecordIds.mockResolvedValue(new Set(['111', '222']));
      const service = await buildService();
      const results = await service.queueRecordDetails(
        request(['111', '444', '222']),
      );
      const scheduledAt = results[1].scheduledAt;
      expect(results).toEqual([
        { recordId: '111', status: 'skipped' },
        { recordId: '444', status: 'queued', scheduledAt },
        { recordId: '222', status: 'skipped' },
      ]);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        { recordId: '444', scheduledAt, detailMode: 'logged-out' },
      ]);
    });
    it('does not publish when every record id is already scraped', async () => {
      storage.readRecordIds.mockResolvedValue(new Set(['111', '222']));
      const service = await buildService();
      const results = await service.queueRecordDetails(
        request(['111', '222', '111']),
      );
      expect(results).toEqual([
        { recordId: '111', status: 'skipped' },
        { recordId: '222', status: 'skipped' },
      ]);
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
    it('stamps scheduledAt as the current dispatch time, not a future offset', async () => {
      const before = Date.now();
      const service = await buildService();
      const [result] = await service.queueRecordDetails(request(['123']));
      const after = Date.now();
      const scheduledAtMs = new Date(result.scheduledAt!).getTime();
      expect(scheduledAtMs).toBeGreaterThanOrEqual(before);
      expect(scheduledAtMs).toBeLessThanOrEqual(after);
    });
    it('throws and does not publish when the list is empty', async () => {
      const service = await buildService();
      await expect(service.queueRecordDetails(request([]))).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
    it('throws and does not publish when a recordId is not numeric', async () => {
      const service = await buildService();
      await expect(
        service.queueRecordDetails(request(['123', 'abc'])),
      ).rejects.toThrow(BadRequestException);
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
  });
  describe('reprocessExpiredRecords', () => {
    it('publishes an expired reprocess message with a generated runId and the requested detail mode', async () => {
      const service = await buildService();
      const result = await service.reprocessExpiredRecords({
        detail_mode: 'logged-in',
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishExpiredReprocess).toHaveBeenCalledWith({
        runId: result.runId,
        detailMode: 'logged-in',
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.reprocessExpiredRecords({
        detail_mode: 'logged-in',
      });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('reprocessXxRecords', () => {
    it('publishes an xx reprocess message with a generated runId and the requested detail mode', async () => {
      const service = await buildService();
      const result = await service.reprocessXxRecords({
        detail_mode: 'logged-in',
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishXxReprocess).toHaveBeenCalledWith({
        runId: result.runId,
        detailMode: 'logged-in',
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.reprocessXxRecords({
        detail_mode: 'logged-in',
      });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
