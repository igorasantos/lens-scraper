import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { ConfigService } from '@app/config';
import { ListingService } from './listing.service.js';
describe('ListingService', () => {
  const modes = {
    listing_mode: 'logged-in',
    detail_mode: 'logged-out',
  } as const;
  let queue: {
    publishListingInit: ReturnType<typeof vi.fn>;
    publishPendingReprocess: ReturnType<typeof vi.fn>;
  };
  let config: {
    siteBaseListingUrl: string | undefined;
  };
  async function buildService(): Promise<ListingService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: QueueService, useValue: queue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return module.get<ListingService>(ListingService);
  }
  beforeEach(() => {
    queue = {
      publishListingInit: vi.fn().mockResolvedValue(undefined),
      publishPendingReprocess: vi.fn().mockResolvedValue(undefined),
    };
    config = {
      siteBaseListingUrl: 'https://www.site.com/search?q=1',
    };
  });
  describe('initListing', () => {
    it('publishes a listing init message with a generated runId and the given baseUrl', async () => {
      const service = await buildService();
      const result = await service.initListing({
        ...modes,
        baseUrl: 'https://example.com/search',
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: undefined,
      });
    });
    it('publishes the given startPage', async () => {
      const service = await buildService();
      const result = await service.initListing({
        ...modes,
        baseUrl: 'https://example.com/search',
        startPage: 3,
      });
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: 3,
      });
    });
    it('publishes the given recycle flag', async () => {
      const service = await buildService();
      const result = await service.initListing({
        ...modes,
        baseUrl: 'https://example.com/search',
        recycle: true,
      });
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: undefined,
        recycle: true,
      });
    });
    it('publishes the given dispatchCount', async () => {
      const service = await buildService();
      const result = await service.initListing({
        ...modes,
        baseUrl: 'https://example.com/search',
        dispatchCount: 5,
      });
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: result.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: undefined,
        dispatchCount: 5,
      });
    });
    it('publishes the listing and detail modes', async () => {
      const service = await buildService();
      await service.initListing({
        listing_mode: 'logged-out',
        detail_mode: 'logged-in',
        baseUrl: 'https://example.com/search',
      });
      expect(queue.publishListingInit).toHaveBeenCalledWith(
        expect.objectContaining({
          listingMode: 'logged-out',
          detailMode: 'logged-in',
        }),
      );
    });
    it('falls back to the configured default baseUrl when none is given', async () => {
      const service = await buildService();
      const result = await service.initListing(modes);
      expect(queue.publishListingInit).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: config.siteBaseListingUrl }),
      );
      expect(result.runId).toBeDefined();
    });
    it('throws when no baseUrl is given and none is configured', async () => {
      config.siteBaseListingUrl = undefined;
      const service = await buildService();
      await expect(service.initListing(modes)).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.initListing({
        ...modes,
        baseUrl: 'https://a.com',
      });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
    it('publishes the given dispatchCount', async () => {
      const service = await buildService();
      const result = await service.reprocessPendingRecords('run-1', {
        detail_mode: 'logged-in',
        dispatchCount: 5,
      });
      expect(queue.publishPendingReprocess).toHaveBeenCalledWith({
        runId: result.runId,
        fromRunId: 'run-1',
        detailMode: 'logged-in',
        dispatchCount: 5,
      });
    });
    it('generates a distinct runId per call', async () => {
      vi.useFakeTimers();
      try {
        const service = await buildService();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const first = await service.initListing({
          ...modes,
          baseUrl: 'https://a.com',
        });
        vi.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
        const second = await service.initListing({
          ...modes,
          baseUrl: 'https://a.com',
        });
        expect(first.runId).not.toBe(second.runId);
      } finally {
        vi.useRealTimers();
      }
    });
  });
  describe('reprocessPendingRecords', () => {
    it('publishes a pending reprocess message with a new runId and the given fromRunId', async () => {
      const service = await buildService();
      const result = await service.reprocessPendingRecords('run-1', {
        detail_mode: 'logged-out',
      });
      expect(result.status).toBe('queued');
      expect(result.fromRunId).toBe('run-1');
      expect(typeof result.runId).toBe('string');
      expect(result.runId).not.toBe('run-1');
      expect(queue.publishPendingReprocess).toHaveBeenCalledWith({
        runId: result.runId,
        fromRunId: 'run-1',
        detailMode: 'logged-out',
      });
    });
    it('publishes the given recycle flag', async () => {
      const service = await buildService();
      const result = await service.reprocessPendingRecords('run-1', {
        detail_mode: 'logged-in',
        recycle: true,
      });
      expect(queue.publishPendingReprocess).toHaveBeenCalledWith({
        runId: result.runId,
        fromRunId: 'run-1',
        detailMode: 'logged-in',
        recycle: true,
      });
    });
    it('generates a distinct runId per call', async () => {
      vi.useFakeTimers();
      try {
        const service = await buildService();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const first = await service.reprocessPendingRecords('run-1', {
          detail_mode: 'logged-out',
        });
        vi.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
        const second = await service.reprocessPendingRecords('run-1', {
          detail_mode: 'logged-out',
        });
        expect(first.runId).not.toBe(second.runId);
      } finally {
        vi.useRealTimers();
      }
    });
    it('throws and does not publish when fromRunId contains a path separator', async () => {
      const service = await buildService();
      await expect(
        service.reprocessPendingRecords('../../etc/passwd', {
          detail_mode: 'logged-out',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(queue.publishPendingReprocess).not.toHaveBeenCalled();
    });
  });
});
