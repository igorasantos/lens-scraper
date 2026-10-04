import { Test, TestingModule } from '@nestjs/testing';
import { SiteConfigService } from '@app/site';
import { StorageService, type RecordDetailCatalogEntry } from '@app/storage';
import { ListingDispatchService } from './listing-dispatch.service.js';
import { RecordsRecycleService } from './records-recycle.service.js';
describe('RecordsRecycleService', () => {
  let storage: {
    readListingIds: ReturnType<typeof vi.fn>;
    readRecordDetailCatalog: ReturnType<typeof vi.fn>;
    readRecycledListingIds: ReturnType<typeof vi.fn>;
    appendRecycledListingId: ReturnType<typeof vi.fn>;
    appendRecordId: ReturnType<typeof vi.fn>;
    recycleRecordDetail: ReturnType<typeof vi.fn>;
    writeToScrapeListingIds: ReturnType<typeof vi.fn>;
  };
  let dispatch: {
    dispatchToScrape: ReturnType<typeof vi.fn>;
  };
  const siteConfig = { expiredRecordDetailDir: 'expired' };
  function catalogOf(
    entries: Record<string, RecordDetailCatalogEntry>,
  ): Map<string, RecordDetailCatalogEntry> {
    return new Map(Object.entries(entries));
  }
  async function buildService(): Promise<RecordsRecycleService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsRecycleService,
        { provide: StorageService, useValue: storage },
        { provide: SiteConfigService, useValue: siteConfig },
        { provide: ListingDispatchService, useValue: dispatch },
      ],
    }).compile();
    return module.get<RecordsRecycleService>(RecordsRecycleService);
  }
  beforeEach(() => {
    storage = {
      readListingIds: vi.fn().mockResolvedValue(['1', '2', '3']),
      readRecordDetailCatalog: vi.fn().mockResolvedValue(
        catalogOf({
          '2': { key: '1_records_catalog/pt/2.html', bucket: 'pt' },
          '9': { key: '1_records_catalog/en/9.html', bucket: 'en' },
        }),
      ),
      readRecycledListingIds: vi.fn().mockResolvedValue([]),
      appendRecycledListingId: vi.fn().mockResolvedValue(undefined),
      appendRecordId: vi.fn().mockResolvedValue(undefined),
      recycleRecordDetail: vi.fn().mockResolvedValue(undefined),
      writeToScrapeListingIds: vi.fn().mockResolvedValue(undefined),
    };
    dispatch = {
      dispatchToScrape: vi.fn().mockResolvedValue({
        dispatched: ['1', '3'],
        reclassified: [],
        deferred: [],
      }),
    };
  });
  it("splits the run's listing ids into recycled (found in the catalog) and to-scrape, and dispatches only the latter", async () => {
    const service = await buildService();
    const result = await service.run('run-1');
    expect(storage.readListingIds).toHaveBeenCalledWith('run-1');
    expect(storage.appendRecordId).toHaveBeenCalledWith('2', 'pt');
    expect(storage.appendRecycledListingId).toHaveBeenCalledWith('run-1', '2');
    expect(storage.recycleRecordDetail).toHaveBeenCalledWith('2', {
      key: '1_records_catalog/pt/2.html',
      bucket: 'pt',
    });
    expect(storage.recycleRecordDetail).toHaveBeenCalledTimes(1);
    expect(storage.writeToScrapeListingIds).toHaveBeenCalledWith('run-1', [
      '1',
      '3',
    ]);
    expect(dispatch.dispatchToScrape).toHaveBeenCalledWith('run-1', ['1', '3']);
    expect(result).toEqual({
      recycled: ['2'],
      toScrape: ['1', '3'],
      dispatched: ['1', '3'],
      reclassified: [],
      deferred: [],
    });
  });
  it('records the id in the bucket file and the run file before moving the html', async () => {
    const callOrder: string[] = [];
    storage.appendRecordId.mockImplementation(async () => {
      callOrder.push('appendRecordId');
    });
    storage.appendRecycledListingId.mockImplementation(async () => {
      callOrder.push('appendRecycledListingId');
    });
    storage.recycleRecordDetail.mockImplementation(async () => {
      callOrder.push('recycleRecordDetail');
    });
    const service = await buildService();
    await service.run('run-1');
    expect(callOrder).toEqual([
      'appendRecordId',
      'appendRecycledListingId',
      'recycleRecordDetail',
    ]);
  });
  it('moves an expired catalog entry without recording it under a language, and hands it to dispatch for language classification', async () => {
    storage.readRecordDetailCatalog.mockResolvedValue(
      catalogOf({
        '2': { key: '1_records_catalog/expired/2.html', bucket: 'expired' },
      }),
    );
    const service = await buildService();
    const result = await service.run('run-1');
    expect(storage.appendRecordId).not.toHaveBeenCalled();
    expect(storage.appendRecycledListingId).toHaveBeenCalledWith('run-1', '2');
    expect(storage.recycleRecordDetail).toHaveBeenCalledTimes(1);
    expect(storage.writeToScrapeListingIds).toHaveBeenCalledWith('run-1', [
      '1',
      '3',
    ]);
    expect(dispatch.dispatchToScrape).toHaveBeenCalledWith('run-1', [
      '1',
      '3',
      '2',
    ]);
    expect(result.recycled).toEqual(['2']);
  });
  it('on a retry, keeps ids already recycled by a previous attempt out of to-scrape even though they left the catalog', async () => {
    storage.readRecycledListingIds.mockResolvedValue(['1', '2']);
    storage.readRecordDetailCatalog.mockResolvedValue(
      catalogOf({
        '2': { key: '1_records_catalog/pt/2.html', bucket: 'pt' },
      }),
    );
    const service = await buildService();
    const result = await service.run('run-1');
    expect(storage.appendRecycledListingId).not.toHaveBeenCalled();
    expect(storage.recycleRecordDetail).toHaveBeenCalledTimes(1);
    expect(storage.writeToScrapeListingIds).toHaveBeenCalledWith('run-1', [
      '3',
    ]);
    expect(dispatch.dispatchToScrape).toHaveBeenCalledWith('run-1', ['3']);
    expect(result.recycled).toEqual(['1', '2']);
    expect(result.toScrape).toEqual(['3']);
  });
  it('writes an empty to-scrape file and dispatches nothing when every id is recycled', async () => {
    storage.readListingIds.mockResolvedValue(['2']);
    const service = await buildService();
    await service.run('run-1');
    expect(storage.writeToScrapeListingIds).toHaveBeenCalledWith('run-1', []);
    expect(dispatch.dispatchToScrape).toHaveBeenCalledWith('run-1', []);
  });
  it('propagates a missing listing-ids.txt without touching the catalog', async () => {
    storage.readListingIds.mockRejectedValue(new Error('No listing-ids.txt'));
    const service = await buildService();
    await expect(service.run('run-1')).rejects.toThrow('No listing-ids.txt');
    expect(storage.readRecordDetailCatalog).not.toHaveBeenCalled();
    expect(dispatch.dispatchToScrape).not.toHaveBeenCalled();
  });
});
