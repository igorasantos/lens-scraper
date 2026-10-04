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
    expect(result.reclassified).toEqual([]);
    expect(storage.writeListingIds).toHaveBeenCalledWith('run-1', ['1', '3']);
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
      reclassified: [],
      deferred: [],
    });
    expect(storage.writeListingIds).toHaveBeenCalledWith('run-1', []);
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
  });
  it('routes ids already saved under 1_records_raw/expired/ to language classification instead of a full re-scrape', async () => {
    storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
      Promise.resolve(id === '2'),
    );
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3']);
    expect(result.dispatched).toEqual(['1', '3']);
    expect(result.reclassified).toEqual(['2']);
    expect(result.skipped).toEqual([]);
    expect(queue.publishRecordLanguageClassifyBatch).toHaveBeenCalledWith([
      { runId: 'run-1', recordId: '2' },
    ]);
    expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    const [published] = queue.publishRecordDetailsBatch.mock.calls[0];
    expect(
      published.map((entry: { recordId: string }) => entry.recordId),
    ).toEqual(['1', '3']);
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
  it('does not let deferred ids count against the cap applied to language classification', async () => {
    config.maxRecordExtractions = 1;
    storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
      Promise.resolve(id === '2'),
    );
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2', '3']);
    expect(result.reclassified).toEqual(['2']);
    expect(result.dispatched).toEqual(['1']);
    expect(result.deferred).toEqual(['3']);
  });
  it('routes every id to language classification and skips scrape.record.detail entirely when all of them are expired', async () => {
    storage.hasExpiredRecordDetail.mockResolvedValue(true);
    const service = await buildService();
    const result = await service.dispatch('run-1', ['1', '2']);
    expect(result.dispatched).toEqual([]);
    expect(result.reclassified).toEqual(['1', '2']);
    expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    expect(queue.publishRecordLanguageClassifyBatch).toHaveBeenCalledWith([
      { runId: 'run-1', recordId: '1' },
      { runId: 'run-1', recordId: '2' },
    ]);
  });
  it('does not check for expired html when there is nothing left to dispatch after dedupe', async () => {
    storage.readRecordIds.mockResolvedValue(new Set(['1']));
    const service = await buildService();
    await service.dispatch('run-1', ['1']);
    expect(storage.hasExpiredRecordDetail).not.toHaveBeenCalled();
  });
  it('writes listing-ids.txt before publishing anything to the queue', async () => {
    const callOrder: string[] = [];
    storage.writeListingIds.mockImplementation(async () => {
      callOrder.push('writeListingIds');
    });
    queue.publishRecordDetailsBatch.mockImplementation(async () => {
      callOrder.push('publishRecordDetailsBatch');
    });
    const service = await buildService();
    await service.dispatch('run-1', ['1', '2']);
    expect(callOrder).toEqual(['writeListingIds', 'publishRecordDetailsBatch']);
  });
  describe('with recycle', () => {
    it('writes listing-ids.txt, then hands the run to recycling instead of publishing any detail or classify task', async () => {
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
        reclassified: [],
        deferred: [],
      });
      expect(storage.hasExpiredRecordDetail).not.toHaveBeenCalled();
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
    it('does not hand anything to recycling when everything is already scraped', async () => {
      storage.readRecordIds.mockResolvedValue(new Set(['1']));
      const service = await buildService();
      await service.dispatch('run-1', ['1'], { recycle: true });
      expect(queue.publishRecordsRecycle).not.toHaveBeenCalled();
    });
    it('does not recycle when the flag is false', async () => {
      const service = await buildService();
      await service.dispatch('run-1', ['1'], { recycle: false });
      expect(queue.publishRecordsRecycle).not.toHaveBeenCalled();
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
    });
  });
  describe('dispatchToScrape', () => {
    it('routes expired ids to classification and caps the rest at MAX_RECORD_EXTRACTIONS, without deduping or touching listing-ids.txt', async () => {
      config.maxRecordExtractions = 1;
      storage.hasExpiredRecordDetail.mockImplementation((id: string) =>
        Promise.resolve(id === '2'),
      );
      const service = await buildService();
      const result = await service.dispatchToScrape('run-1', ['1', '2', '3']);
      expect(result).toEqual({
        dispatched: ['1'],
        reclassified: ['2'],
        deferred: ['3'],
      });
      expect(storage.readRecordIds).not.toHaveBeenCalled();
      expect(storage.writeListingIds).not.toHaveBeenCalled();
    });
    it('publishes nothing for an empty list', async () => {
      const service = await buildService();
      const result = await service.dispatchToScrape('run-1', []);
      expect(result).toEqual({
        dispatched: [],
        reclassified: [],
        deferred: [],
      });
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
      expect(queue.publishRecordLanguageClassifyBatch).not.toHaveBeenCalled();
    });
  });
});
