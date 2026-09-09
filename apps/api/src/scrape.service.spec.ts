import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { ConfigService } from '@app/config';
import { ScrapeService } from './scrape.service.js';
describe('ScrapeService', () => {
  let queue: {
    publishListingInit: ReturnType<typeof vi.fn>;
    publishListingContinue: ReturnType<typeof vi.fn>;
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishExpiredReprocess: ReturnType<typeof vi.fn>;
    publishXxReprocess: ReturnType<typeof vi.fn>;
    publishRecordTitlesExtract: ReturnType<typeof vi.fn>;
    publishRecordTitlesDedupSort: ReturnType<typeof vi.fn>;
    publishRecordTitlesFilter: ReturnType<typeof vi.fn>;
    publishRecordsFilter: ReturnType<typeof vi.fn>;
  };
  let config: {
    siteBaseListingUrl: string | undefined;
  };
  async function buildService(): Promise<ScrapeService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapeService,
        { provide: QueueService, useValue: queue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return module.get<ScrapeService>(ScrapeService);
  }
  beforeEach(() => {
    queue = {
      publishListingInit: vi.fn().mockResolvedValue(undefined),
      publishListingContinue: vi.fn().mockResolvedValue(undefined),
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishExpiredReprocess: vi.fn().mockResolvedValue(undefined),
      publishXxReprocess: vi.fn().mockResolvedValue(undefined),
      publishRecordTitlesExtract: vi.fn().mockResolvedValue(undefined),
      publishRecordTitlesDedupSort: vi.fn().mockResolvedValue(undefined),
      publishRecordTitlesFilter: vi.fn().mockResolvedValue(undefined),
      publishRecordsFilter: vi.fn().mockResolvedValue(undefined),
    };
    config = {
      siteBaseListingUrl: 'https://www.site.com/search?q=1',
    };
  });
  describe('initListing', () => {
    it('publishes a listing init message with a generated runId and the given baseUrl', async () => {
      const service = await buildService();
      const result = await service.initListing({
        baseUrl: 'https://example.com/search',
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        startPage: undefined,
      });
    });
    it('publishes the given startPage', async () => {
      const service = await buildService();
      const result = await service.initListing({
        baseUrl: 'https://example.com/search',
        startPage: 3,
      });
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        startPage: 3,
      });
    });
    it('falls back to the configured default baseUrl when none is given', async () => {
      const service = await buildService();
      const result = await service.initListing({});
      expect(queue.publishListingInit).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: config.siteBaseListingUrl }),
      );
      expect(result.runId).toBeDefined();
    });
    it('throws when no baseUrl is given and none is configured', async () => {
      config.siteBaseListingUrl = undefined;
      const service = await buildService();
      await expect(service.initListing({})).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.initListing({ baseUrl: 'https://a.com' });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
    it('generates a distinct runId per call', async () => {
      vi.useFakeTimers();
      try {
        const service = await buildService();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const first = await service.initListing({ baseUrl: 'https://a.com' });
        vi.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
        const second = await service.initListing({
          baseUrl: 'https://a.com',
        });
        expect(first.runId).not.toBe(second.runId);
      } finally {
        vi.useRealTimers();
      }
    });
  });
  describe('continueListing', () => {
    it('publishes a listing continue message with a new runId and the given fromRunId', async () => {
      const service = await buildService();
      const result = await service.continueListing('run-1');
      expect(result.status).toBe('queued');
      expect(result.fromRunId).toBe('run-1');
      expect(typeof result.runId).toBe('string');
      expect(result.runId).not.toBe('run-1');
      expect(queue.publishListingContinue).toHaveBeenCalledWith({
        runId: result.runId,
        fromRunId: 'run-1',
      });
    });
    it('generates a distinct runId per call', async () => {
      vi.useFakeTimers();
      try {
        const service = await buildService();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const first = await service.continueListing('run-1');
        vi.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
        const second = await service.continueListing('run-1');
        expect(first.runId).not.toBe(second.runId);
      } finally {
        vi.useRealTimers();
      }
    });
    it('throws and does not publish when fromRunId contains a path separator', async () => {
      const service = await buildService();
      await expect(service.continueListing('../../etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishListingContinue).not.toHaveBeenCalled();
    });
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
  describe('extractRecordTitles', () => {
    it('publishes a record titles extract message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.extractRecordTitles();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesExtract).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.extractRecordTitles();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('dedupSortRecordTitles', () => {
    it('publishes a record titles dedup-sort message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.dedupSortRecordTitles();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesDedupSort).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.dedupSortRecordTitles();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('filterRecordTitles', () => {
    it('publishes a record titles filter message with a generated runId and the given substrings', async () => {
      const service = await buildService();
      const result = await service.filterRecordTitles({
        substrings: ['Laptop', 'home'],
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesFilter).toHaveBeenCalledWith({
        runId: result.runId,
        substrings: ['Laptop', 'home'],
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.filterRecordTitles({ substrings: ['x'] });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
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
