import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { ListingDispatchService } from './listing-dispatch.service.js';
describe('ListingDispatchService', () => {
  let storage: {
    readRecordIds: ReturnType<typeof vi.fn>;
    writeListingIds: ReturnType<typeof vi.fn>;
    hasExpiredRecordDetail: ReturnType<typeof vi.fn>;
  };
  let queue: {
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishRecordLanguageClassifyBatch: ReturnType<typeof vi.fn>;
    publishRecordsRecycle: ReturnType<typeof vi.fn>;
  };
  let config: {
    maxRecordExtractions: number;
  };
  async function buildService(): Promise<ListingDispatchService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingDispatchService,
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return module.get<ListingDispatchService>(ListingDispatchService);
  }
  beforeEach(() => {
    storage = {
      readRecordIds: vi.fn().mockResolvedValue(new Set()),
      writeListingIds: vi.fn().mockResolvedValue(undefined),
      hasExpiredRecordDetail: vi.fn().mockResolvedValue(false),
    };
    queue = {
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishRecordLanguageClassifyBatch: vi.fn().mockResolvedValue(undefined),
      publishRecordsRecycle: vi.fn().mockResolvedValue(undefined),
    };
    config = { maxRecordExtractions: 20 };
  });
  it('dedupes against records.txt, stamps a shared scheduledAt, and publishes the rest', async () => {
    storage.readRecordIds.mockResolvedValue(new Set(['2']));
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3']);
    expect(result.dispatched).toEqual(['1', '3']);
    expect(result.skipped).toEqual(['2']);
    expect(storage.writeListingIds).not.toHaveBeenCalled();
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
    expect(published).toHaveLength(2);
    expect(published[0].scheduledAt).toBe(published[1].scheduledAt);
    expect(published).toEqual([
      { recordId: '1', scheduledAt: published[0].scheduledAt, runId: 'run-1' },
      { recordId: '3', scheduledAt: published[1].scheduledAt, runId: 'run-1' },
    ]);
    expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
  });
  it('deduplicates repeated ids within the input itself', async () => {
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '1', '2']);
    expect(result.dispatched).toEqual(['1', '2']);
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    expect(queue.publishRecordDetailsBatch.mock.calls[0][0]).toHaveLength(2);
  });
  it('publishes nothing when everything is already scraped', async () => {
    storage.readRecordIds.mockResolvedValue(new Set(['1', '2']));
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2']);
    expect(result).toEqual({
      dispatched: [],
      skipped: ['1', '2'],
      deferred: [],
    });
    expect(storage.writeListingIds).not.toHaveBeenCalled();
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
  });
  it('skips ids already saved under the scraped expired dir, without classifying or scraping them', async () => {
    storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
      Promise.resolve(id === '2'),
    );
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3']);
    expect(result.dispatched).toEqual(['1', '3']);
    expect(result.skipped).toEqual(['2']);
    expect(storage.writeListingIds).not.toHaveBeenCalled();
    expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
    expect(
      published.map((entry: { recordId: string }) => entry.recordId),
    ).toEqual(['1', '3']);
  });
  it('logs the full count message including ids skipped for being in the scraped expired dir', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    storage.readRecordIds.mockResolvedValue(new Set(['1']));
    storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
      Promise.resolve(id === '2'),
    );
    const service = await buildService();
    await service.dispatch('run-1', ['1', '2', '2', '3']);
    expect(log).toHaveBeenCalledWith(
      '[run-1] 4 record id(s) received - 1 duplicate(s) = 3 unique - 1 already in the scraped records control files - 1 already in the scraped expired dir = 1 record(s) left to dispatch.',
    );
    log.mockRestore();
  });
  it('caps scrape.record.detail dispatch at MAX_RECORD_EXTRACTIONS, deferring the rest', async () => {
    config.maxRecordExtractions = 2;
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3', '4']);
    expect(result.dispatched).toEqual(['1', '2']);
    expect(result.deferred).toEqual(['3', '4']);
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    expect(
      queue.publishRecordDetailsBatch.mock.calls[0][0].map(
        (entry: { recordId: string }) => entry.recordId,
      ),
    ).toEqual(['1', '2']);
  });
  it('lets dispatchCount override MAX_RECORD_EXTRACTIONS', async () => {
    config.maxRecordExtractions = 2;
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3', '4'], {
      dispatchCount: 3,
    });
    expect(result.dispatched).toEqual(['1', '2', '3']);
    expect(result.deferred).toEqual(['4']);
  });
  it('publishes nothing when every new id is already in the scraped expired dir', async () => {
    storage.hasExpiredRecordDetail.mockResolvedValue(true);
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2']);
    expect(result).toEqual({
      dispatched: [],
      skipped: ['1', '2'],
      deferred: [],
    });
    expect(storage.writeListingIds).not.toHaveBeenCalled();
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
  });
  it('does not check for expired html for ids already in the scraped records control files', async () => {
    storage.readRecordIds.mockResolvedValue(new Set(['1']));
    const service = await buildService();
    await service.dispatch('run-1', ['1']);
    expect(storage.hasExpiredRecordDetail).not.toHaveBeenCalled();
  });
  describe('with recycle', () => {
    it('forwards dispatchCount on the recycle message', async () => {
      const service = await buildService();
      await service.dispatch('run-1', ['1'], {
        recycle: true,
        dispatchCount: 5,
      });
      expect(queue.publishRecordsRecycle).toHaveBeenCalledWith({
        runId: 'run-1',
        dispatchCount: 5,
      });
    });
    it('writes listing_ids_new.txt, then hands the run to recycling instead of publishing any detail or classify task', async () => {
      const callOrder: string[] = [];
      storage.readRecordIds.mockResolvedValue(new Set(['2']));
      storage.writeListingIds.mockImplementation(async () => {
        callOrder.push('writeListingIds');
      });
      queue.publishRecordsRecycle.mockImplementation(async () => {
        callOrder.push('publishRecordsRecycle');
      });
      const service = await buildService();
      const result = await service.dispatch('run-1', ['1', '2', '3'], {
        recycle: true,
      });
      expect(storage.writeListingIds).toHaveBeenCalledWith('run-1', ['1', '3']);
      expect(queue.publishRecordsRecycle).toHaveBeenCalledWith({
        runId: 'run-1',
      });
      expect(callOrder).toEqual(['writeListingIds', 'publishRecordsRecycle']);
      expect(result).toEqual({
        dispatched: [],
        skipped: ['2'],
        deferred: [],
      });
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
    it('logs the full count message from received ids down to what is handed to recycling', async () => {
      const log = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      storage.readRecordIds.mockResolvedValue(new Set(['2']));
      const service = await buildService();
      await service.dispatch('run-1', ['1', '1', '2', '3', '3'], {
        recycle: true,
      });
      expect(log).toHaveBeenCalledWith(
        '[run-1] 5 record id(s) received - 2 duplicate(s) = 3 unique - 1 already in the scraped records control files - 0 already in the scraped expired dir = 2 record(s) handed to recycling before scraping.',
      );
      log.mockRestore();
    });
    it('keeps ids already in the scraped expired dir out of listing_ids_new.txt so recycling never sees them', async () => {
      storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
        Promise.resolve(id === '2'),
      );
      const service = await buildService();
      const result = await service.dispatch('run-1', ['1', '2'], {
        recycle: true,
      });
      expect(storage.writeListingIds).toHaveBeenCalledWith('run-1', ['1']);
      expect(result.skipped).toEqual(['2']);
      expect(queue.publishRecordsRecycle).toHaveBeenCalledWith({
        runId: 'run-1',
      });
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
    it('does not hand anything to recycling when everything is already scraped', async () => {
      storage.readRecordIds.mockResolvedValue(new Set(['1']));
      const service = await buildService();
      await service.dispatch('run-1', ['1'], { recycle: true });
      expect(storage.writeListingIds).not.toHaveBeenCalled();
      expect(queue.publishRecordsRecycle).not.toHaveBeenCalled();
    });
    it('does not recycle or write listing_ids_new.txt when the flag is false', async () => {
      const service = await buildService();
      await service.dispatch('run-1', ['1'], { recycle: false });
      expect(storage.writeListingIds).not.toHaveBeenCalled();
      expect(queue.publishRecordsRecycle).not.toHaveBeenCalled();
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    });
  });
  describe('dispatchToScrape', () => {
    it('caps at MAX_RECORD_EXTRACTIONS without deduping, checking for expired html, or touching listing_ids_new.txt', async () => {
      config.maxRecordExtractions = 2;
      const service = await buildService();
      const result = await service.dispatchToScrape('run-1', ['1', '2', '3']);
      expect(result).toEqual({
        dispatched: ['1', '2'],
        deferred: ['3'],
      });
      expect(storage.readRecordIds).not.toHaveBeenCalled();
      expect(storage.writeListingIds).not.toHaveBeenCalled();
      expect(storage.hasExpiredRecordDetail).not.toHaveBeenCalled();
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
    it('publishes nothing for an empty list', async () => {
      const service = await buildService();
      const result = await service.dispatchToScrape('run-1', []);
      expect(result).toEqual({
        dispatched: [],
        deferred: [],
      });
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
  });
});
