import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ConfigService } from '@app/config';
import { SiteConfigService } from '@app/site';
import { LOCK_KEY_PREFIX, LOCK_PORT, type LockPort } from '@app/redis-lock';
import { STORAGE_PORT } from './storage-port.token.js';
import type { StorageListOptions, StoragePort } from './storage.port.js';
import { StorageService } from './storage.service.js';
class FakeConfigService {
  fileLockTtlMs = 5000;
  fileLockRetryIntervalMs = 50;
  fileLockMaxWaitMs = 5000;
}
class FakeSiteConfigService {
  recordsFilePattern = /^records_(.+)\.txt$/;
  expiredRecordsFilename = 'records_expired.txt';
  unknownLanguageBucket = 'xx';
  recordDetailRootDir = '1_records_raw';
  recordDetailCatalogDir = '1_records_catalog';
  expiredRecordDetailDir = 'expired';
  sourceDetailRootDir = '0_sources';
  recordTitlesRootDir = '2_record_titles';
  recordsFilteredRootDir = '3_records_filtered';
  listingIdsFilename = 'listing-ids.txt';
  rawListingIdsFilename = 'raw_listing_ids.txt';
  listingIdsFilenameRecycled = 'listing-ids-recycled.txt';
  listingIdsFilenameToScrape = 'listing-ids-to-scrape.txt';
  failuresLogFilename = 'failures.log';
  sourcesFilename = 'sources.txt';
  recordTitlesRawFilename = '1_raw.txt';
  recordTitlesDedupSortedFilename = '2_dedup_sorted.txt';
  recordTitlesFilteredFilename = '3_filtered.txt';
  recordsFilename(languageAlpha2: string): string {
    return `records_${languageAlpha2}.txt`;
  }
}
class FakeStoragePort implements StoragePort {
  readonly files = new Map<string, string>();
  async read(key: string): Promise<string> {
    const value = this.files.get(key);
    if (value === undefined) {
      const error = new Error(`ENOENT: ${key}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return value;
  }
  async write(key: string, content: string): Promise<void> {
    this.files.set(key, content);
  }
  async append(key: string, content: string): Promise<void> {
    this.files.set(key, (this.files.get(key) ?? '') + content);
  }
  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }
  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
  readonly listCalls: { prefix: string; options?: StorageListOptions }[] = [];
  async list(prefix: string, options?: StorageListOptions): Promise<string[]> {
    this.listCalls.push({ prefix, options });
    const normalizedPrefix = prefix === '' ? '' : `${prefix}/`;
    const recursive = options?.recursive ?? true;
    return [...this.files.keys()].filter(
      (key) =>
        key.startsWith(normalizedPrefix) &&
        (recursive || !key.slice(normalizedPrefix.length).includes('/')),
    );
  }
  async copy(sourceKey: string, destKey: string): Promise<void> {
    this.files.set(destKey, await this.read(sourceKey));
  }
  async move(sourceKey: string, destKey: string): Promise<void> {
    this.files.set(destKey, await this.read(sourceKey));
    this.files.delete(sourceKey);
  }
}
class FakeLockPort implements LockPort {
  private readonly holders = new Map<string, string>();
  async acquire(key: string): Promise<string | null> {
    if (this.holders.has(key)) {
      return null;
    }
    const token = randomUUID();
    this.holders.set(key, token);
    return token;
  }
  async release(key: string, token: string): Promise<boolean> {
    if (this.holders.get(key) !== token) {
      return false;
    }
    this.holders.delete(key);
    return true;
  }
  async extend(key: string, token: string): Promise<boolean> {
    return this.holders.get(key) === token;
  }
}
describe('StorageService', () => {
  let service: StorageService;
  let storage: FakeStoragePort;
  beforeEach(async () => {
    storage = new FakeStoragePort();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PORT, useValue: storage },
        { provide: SiteConfigService, useClass: FakeSiteConfigService },
        { provide: LOCK_PORT, useClass: FakeLockPort },
        { provide: ConfigService, useClass: FakeConfigService },
      ],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('read() delegates to the storage port by key', async () => {
    storage.files.set('1_records_raw/en/111.html', '<div>111</div>');
    await expect(service.read('1_records_raw/en/111.html')).resolves.toBe(
      '<div>111</div>',
    );
  });
  it('re-throws a non-ENOENT error from the storage port instead of treating it as a missing file', async () => {
    const boom = new Error('disk on fire') as NodeJS.ErrnoException;
    boom.code = 'EACCES';
    vi.spyOn(storage, 'read').mockRejectedValueOnce(boom);
    await expect(service.readRawListingIds('run-1')).rejects.toBe(boom);
  });
  it('withFileLock times out and throws when the lock cannot be acquired before the deadline', async () => {
    const contendedConfig = {
      ...new FakeConfigService(),
      fileLockMaxWaitMs: 0,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PORT, useValue: storage },
        { provide: SiteConfigService, useClass: FakeSiteConfigService },
        { provide: LOCK_PORT, useValue: new FakeLockPort() },
        { provide: ConfigService, useValue: contendedConfig },
      ],
    }).compile();
    const contendedService = module.get<StorageService>(StorageService);
    const lock = module.get<FakeLockPort>(LOCK_PORT);
    await lock.acquire(`${LOCK_KEY_PREFIX}:file-lock:sources.txt`, 5000);
    await expect(
      contendedService.appendSourceName('source-alpha'),
    ).rejects.toThrow(/Timed out waiting for file lock/);
  });
  it('builds the listing-ids key under runs/<runId>', () => {
    expect(service.listingIdsPath('run-1')).toBe(
      join('runs', 'run-1', 'listing-ids.txt'),
    );
  });
  it('builds the raw-listing-ids key under runs/<runId>', () => {
    expect(service.rawListingIdsPath('run-1')).toBe(
      join('runs', 'run-1', 'raw_listing_ids.txt'),
    );
  });
  it('appendRawListingIds appends record ids as newline-separated entries', async () => {
    await service.appendRawListingIds('run-1', ['111', '222']);
    await service.appendRawListingIds('run-1', ['333']);
    await expect(
      storage.read(service.rawListingIdsPath('run-1')),
    ).resolves.toBe('111\n222\n333\n');
  });
  it('appendRawListingIds does nothing when given an empty list', async () => {
    await service.appendRawListingIds('run-1', []);
    expect(storage.files.has(service.rawListingIdsPath('run-1'))).toBe(false);
  });
  it("readRawListingIds returns the trimmed, non-empty ids from a run's raw_listing_ids.txt", async () => {
    await service.appendRawListingIds('run-1', ['111', '222']);
    await service.appendRawListingIds('run-1', [' 333 ']);
    await expect(service.readRawListingIds('run-1')).resolves.toEqual([
      '111',
      '222',
      '333',
    ]);
  });
  it('readRawListingIds preserves duplicates across pages (dedupe happens downstream)', async () => {
    storage.files.set(service.rawListingIdsPath('run-1'), '111\n222\n\n111\n');
    await expect(service.readRawListingIds('run-1')).resolves.toEqual([
      '111',
      '222',
      '111',
    ]);
  });
  it('readRawListingIds throws when the run has no raw_listing_ids.txt', async () => {
    await expect(service.readRawListingIds('missing-run')).rejects.toThrow();
  });
  it('writeListingIds writes the final, deduped ids', async () => {
    await service.writeListingIds('run-1', ['111', '222']);
    await expect(storage.read(service.listingIdsPath('run-1'))).resolves.toBe(
      '111\n222\n',
    );
  });
  it('writeListingIds overwrites rather than appending', async () => {
    await service.writeListingIds('run-1', ['111']);
    await service.writeListingIds('run-1', ['222']);
    await expect(storage.read(service.listingIdsPath('run-1'))).resolves.toBe(
      '222\n',
    );
  });
  it('builds the records_<alpha2>.txt key directly under the data dir root', () => {
    expect(service.recordsPath('en')).toBe('records_en.txt');
  });
  it('readRecordIds returns an empty set when no records_<alpha2>.txt exists', async () => {
    await expect(service.readRecordIds()).resolves.toEqual(new Set());
  });
  it('readRecordIds unions ids across every per-language records_<alpha2>.txt', async () => {
    storage.files.set(service.recordsPath('en'), '111\n222\n\n333\n');
    storage.files.set(service.recordsPath('pt'), '444\n111\n');
    await expect(service.readRecordIds()).resolves.toEqual(
      new Set(['111', '222', '333', '444']),
    );
  });
  it('readRecordIds ignores records_expired.txt even though it matches the records_<alpha2>.txt pattern', async () => {
    storage.files.set(service.recordsPath('en'), '111\n');
    storage.files.set(service.expiredRecordsPath(), '999\n');
    await expect(service.readRecordIds()).resolves.toEqual(new Set(['111']));
  });
  it('readRecordIds ignores nested keys that happen to contain "records_" (e.g. inside 1_records_raw/)', async () => {
    storage.files.set(service.recordsPath('en'), '111\n');
    storage.files.set('1_records_raw/en/records_lookalike.html', '<div></div>');
    await expect(service.readRecordIds()).resolves.toEqual(new Set(['111']));
  });
  it('readRecordIds lists only the storage root, without descending into subdirectories', async () => {
    storage.files.set(service.recordsPath('en'), '111\n');
    storage.files.set('nested/records_pt.txt', '222\n');
    await expect(service.readRecordIds()).resolves.toEqual(new Set(['111']));
    expect(storage.listCalls).toEqual([
      { prefix: '', options: { recursive: false } },
    ]);
  });
  it('builds the record detail key under 1_records_raw/<alpha2>/<record_id>.html', () => {
    expect(service.recordDetailPath('en', '123')).toBe(
      join('1_records_raw', 'en', '123.html'),
    );
  });
  it('builds the expired record detail key under 1_records_raw/expired/<record_id>.html', () => {
    expect(service.expiredRecordDetailPath('123')).toBe(
      join('1_records_raw', 'expired', '123.html'),
    );
  });
  it('writeRecordDetail writes the html snippet', async () => {
    await service.writeRecordDetail('en', '123', '<div>ok</div>');
    await expect(
      storage.read(service.recordDetailPath('en', '123')),
    ).resolves.toBe('<div>ok</div>');
  });
  it('writeRecordDetail overwrites rather than appending', async () => {
    await service.writeRecordDetail('en', '123', '<div>first</div>');
    await service.writeRecordDetail('en', '123', '<div>second</div>');
    await expect(
      storage.read(service.recordDetailPath('en', '123')),
    ).resolves.toBe('<div>second</div>');
  });
  it('appendRecordId appends to the cumulative records_<alpha2>.txt', async () => {
    await service.appendRecordId('111', 'en');
    await service.appendRecordId('222', 'en');
    await expect(storage.read(service.recordsPath('en'))).resolves.toBe(
      '111\n222\n',
    );
  });
  it('builds the sources.txt key directly under the data dir root', () => {
    expect(service.sourcesPath()).toBe('sources.txt');
  });
  it('appendSourceName appends to the cumulative sources.txt', async () => {
    await service.appendSourceName('source-alpha');
    await service.appendSourceName('source-beta');
    await expect(storage.read(service.sourcesPath())).resolves.toBe(
      'source-alpha\nsource-beta\n',
    );
  });
  it('appendSourceName does not duplicate a name already present', async () => {
    await service.appendSourceName('source-alpha');
    await service.appendSourceName('source-alpha');
    await expect(storage.read(service.sourcesPath())).resolves.toBe(
      'source-alpha\n',
    );
  });
  it('appendSourceName returns true the first time a name is added, false thereafter', async () => {
    await expect(service.appendSourceName('source-alpha')).resolves.toBe(true);
    await expect(service.appendSourceName('source-alpha')).resolves.toBe(false);
  });
  it('appendSourceName serializes concurrent calls so neither name is lost to a race on the read-modify-write', async () => {
    const results = await Promise.all([
      service.appendSourceName('source-alpha'),
      service.appendSourceName('source-beta'),
    ]);
    expect(results).toEqual([true, true]);
    await expect(service.readSourceNames()).resolves.toEqual(
      new Set(['source-alpha', 'source-beta']),
    );
  });
  it('builds the source detail key under 0_sources/<name>.html', () => {
    expect(service.sourceDetailPath('source-alpha')).toBe(
      join('0_sources', 'source-alpha.html'),
    );
  });
  it('writeSourceDetail writes the html snippet', async () => {
    await service.writeSourceDetail('source-alpha', '<div>about source</div>');
    await expect(
      storage.read(service.sourceDetailPath('source-alpha')),
    ).resolves.toBe('<div>about source</div>');
  });
  it('writeSourceDetail overwrites rather than appending', async () => {
    await service.writeSourceDetail('source-alpha', '<div>first</div>');
    await service.writeSourceDetail('source-alpha', '<div>second</div>');
    await expect(
      storage.read(service.sourceDetailPath('source-alpha')),
    ).resolves.toBe('<div>second</div>');
  });
  it('readSourceNames returns an empty set when sources.txt does not exist', async () => {
    await expect(service.readSourceNames()).resolves.toEqual(new Set());
  });
  it('readSourceNames parses sources.txt into a set of trimmed names', async () => {
    storage.files.set(
      service.sourcesPath(),
      'source-alpha\nsource-gamma\n\nsource-alpha\n',
    );
    await expect(service.readSourceNames()).resolves.toEqual(
      new Set(['source-alpha', 'source-gamma']),
    );
  });
  it('builds the failures log key under runs/<runId>', () => {
    expect(service.failuresLogPath('run-1')).toBe(
      join('runs', 'run-1', 'failures.log'),
    );
  });
  it('appendFailure writes one JSON line per entry with a timestamp', async () => {
    await service.appendFailure('run-1', {
      recordId: '123',
      reason: 'missing-section',
      attempts: 3,
    });
    const contents = await storage.read(service.failuresLogPath('run-1'));
    const lines = contents.trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      recordId: '123',
      reason: 'missing-section',
      attempts: 3,
    });
    expect(typeof entry.timestamp).toBe('string');
  });
  describe('record detail catalog recycling', () => {
    it('readListingIds returns the trimmed, non-empty ids of the run', async () => {
      storage.files.set(join('runs', 'run-1', 'listing-ids.txt'), '1\n 2 \n\n');
      await expect(service.readListingIds('run-1')).resolves.toEqual([
        '1',
        '2',
      ]);
    });
    it('readListingIds throws a descriptive error when the run has no listing-ids.txt', async () => {
      await expect(service.readListingIds('run-1')).rejects.toThrow(
        'No listing-ids.txt found for run run-1',
      );
    });
    it('builds the recycled and to-scrape listing ids keys under runs/<runId>', () => {
      expect(service.recycledListingIdsPath('run-1')).toBe(
        join('runs', 'run-1', 'listing-ids-recycled.txt'),
      );
      expect(service.toScrapeListingIdsPath('run-1')).toBe(
        join('runs', 'run-1', 'listing-ids-to-scrape.txt'),
      );
    });
    it('appendRecycledListingId appends one id per line and readRecycledListingIds reads them back', async () => {
      await expect(service.readRecycledListingIds('run-1')).resolves.toEqual(
        [],
      );
      await service.appendRecycledListingId('run-1', '1');
      await service.appendRecycledListingId('run-1', '2');
      expect(
        storage.files.get(join('runs', 'run-1', 'listing-ids-recycled.txt')),
      ).toBe('1\n2\n');
      await expect(service.readRecycledListingIds('run-1')).resolves.toEqual([
        '1',
        '2',
      ]);
    });
    it('writeToScrapeListingIds overwrites the entry with one id per line', async () => {
      const key = join('runs', 'run-1', 'listing-ids-to-scrape.txt');
      storage.files.set(key, 'stale\n');
      await service.writeToScrapeListingIds('run-1', ['3', '4']);
      expect(storage.files.get(key)).toBe('3\n4\n');
    });
    it('readRecordDetailCatalog indexes every html file recursively by record id, with its parent dir as bucket', async () => {
      storage.files.set('1_records_catalog/en/1.html', 'en');
      storage.files.set('1_records_catalog/batch-a/pt/2.html', 'pt');
      storage.files.set('1_records_catalog/expired/3.html', 'expired');
      storage.files.set('1_records_catalog/4.html', 'root');
      storage.files.set('1_records_catalog/en/notes.txt', 'ignored');
      storage.files.set('1_records_raw/en/5.html', 'not in the catalog');
      const catalog = await service.readRecordDetailCatalog();
      expect(storage.listCalls).toEqual([
        { prefix: '1_records_catalog', options: undefined },
      ]);
      expect(Object.fromEntries(catalog)).toEqual({
        '1': { key: '1_records_catalog/en/1.html', bucket: 'en' },
        '2': { key: '1_records_catalog/batch-a/pt/2.html', bucket: 'pt' },
        '3': { key: '1_records_catalog/expired/3.html', bucket: 'expired' },
        '4': { key: '1_records_catalog/4.html', bucket: 'xx' },
      });
    });
    it('readRecordDetailCatalog keeps the first entry when a record id appears more than once', async () => {
      storage.files.set('1_records_catalog/en/1.html', 'en');
      storage.files.set('1_records_catalog/pt/1.html', 'pt');
      const catalog = await service.readRecordDetailCatalog();
      expect(catalog.get('1')).toEqual({
        key: '1_records_catalog/en/1.html',
        bucket: 'en',
      });
    });
    it('readRecordDetailCatalog returns an empty map when the catalog dir has no entries', async () => {
      await expect(service.readRecordDetailCatalog()).resolves.toEqual(
        new Map(),
      );
    });
    it('recycleRecordDetail moves the catalog html into the same bucket under 1_records_raw/', async () => {
      storage.files.set('1_records_catalog/batch-a/pt/2.html', '<div>2</div>');
      const destKey = await service.recycleRecordDetail('2', {
        key: '1_records_catalog/batch-a/pt/2.html',
        bucket: 'pt',
      });
      expect(destKey).toBe(join('1_records_raw', 'pt', '2.html'));
      expect(storage.files.get(destKey)).toBe('<div>2</div>');
      expect(storage.files.has('1_records_catalog/batch-a/pt/2.html')).toBe(
        false,
      );
    });
    it('recycleRecordDetail moves a catalog html from the expired bucket under 1_records_raw/expired/', async () => {
      storage.files.set('1_records_catalog/expired/3.html', '<div>3</div>');
      const destKey = await service.recycleRecordDetail('3', {
        key: '1_records_catalog/expired/3.html',
        bucket: 'expired',
      });
      expect(destKey).toBe(service.expiredRecordDetailPath('3'));
      await expect(service.hasExpiredRecordDetail('3')).resolves.toBe(true);
    });
  });
  describe('expired records tracking', () => {
    it('builds the expired records key directly under the data dir root', () => {
      expect(service.expiredRecordsPath()).toBe('records_expired.txt');
    });
    it('appendExpiredRecord appends the record id as a newline-separated entry', async () => {
      await service.appendExpiredRecord('111');
      await service.appendExpiredRecord('222');
      await expect(storage.read(service.expiredRecordsPath())).resolves.toBe(
        '111\n222\n',
      );
    });
    it('appendExpiredRecord does not duplicate a record id already present', async () => {
      await service.appendExpiredRecord('111');
      await service.appendExpiredRecord('111');
      await expect(storage.read(service.expiredRecordsPath())).resolves.toBe(
        '111\n',
      );
    });
    it('readExpiredRecordIds returns an empty array when records_expired.txt does not exist', async () => {
      await expect(service.readExpiredRecordIds()).resolves.toEqual([]);
    });
    it('readExpiredRecordIds returns the trimmed, deduped, non-empty ids', async () => {
      storage.files.set(service.expiredRecordsPath(), '111\n222\n\n111\n');
      await expect(service.readExpiredRecordIds()).resolves.toEqual([
        '111',
        '222',
      ]);
    });
    it('removeExpiredRecord removes the record id and returns true when it was present', async () => {
      await service.appendExpiredRecord('111');
      await service.appendExpiredRecord('222');
      await expect(service.removeExpiredRecord('111')).resolves.toBe(true);
      await expect(storage.read(service.expiredRecordsPath())).resolves.toBe(
        '222\n',
      );
    });
    it('removeExpiredRecord returns false and leaves the file untouched when the record id is absent', async () => {
      await service.appendExpiredRecord('111');
      await expect(service.removeExpiredRecord('999')).resolves.toBe(false);
      await expect(storage.read(service.expiredRecordsPath())).resolves.toBe(
        '111\n',
      );
    });
    it('removeExpiredRecord returns false when records_expired.txt does not exist', async () => {
      await expect(service.removeExpiredRecord('111')).resolves.toBe(false);
    });
    it('appendExpiredRecord serializes concurrent calls so neither id is lost to a race on the read-modify-write', async () => {
      await Promise.all([
        service.appendExpiredRecord('111'),
        service.appendExpiredRecord('222'),
      ]);
      await expect(service.readExpiredRecordIds()).resolves.toEqual(
        expect.arrayContaining(['111', '222']),
      );
    });
    it('a concurrent removeExpiredRecord waits for an in-flight appendExpiredRecord on the same file rather than racing it', async () => {
      await service.appendExpiredRecord('111');
      const [, removed] = await Promise.all([
        service.appendExpiredRecord('222'),
        service.removeExpiredRecord('111'),
      ]);
      expect(removed).toBe(true);
      await expect(service.readExpiredRecordIds()).resolves.toEqual(['222']);
    });
    it('writeExpiredRecordDetail writes the html snippet under 1_records_raw/expired/', async () => {
      await service.writeExpiredRecordDetail('123', '<div>expired</div>');
      await expect(
        storage.read(service.expiredRecordDetailPath('123')),
      ).resolves.toBe('<div>expired</div>');
    });
    it('writeExpiredRecordDetail overwrites rather than appending', async () => {
      await service.writeExpiredRecordDetail('123', '<div>first</div>');
      await service.writeExpiredRecordDetail('123', '<div>second</div>');
      await expect(
        storage.read(service.expiredRecordDetailPath('123')),
      ).resolves.toBe('<div>second</div>');
    });
    it('hasExpiredRecordDetail returns false when no expired html was ever written', async () => {
      await expect(service.hasExpiredRecordDetail('123')).resolves.toBe(false);
    });
    it('hasExpiredRecordDetail returns true once the expired html has been written', async () => {
      await service.writeExpiredRecordDetail('123', '<div>expired</div>');
      await expect(service.hasExpiredRecordDetail('123')).resolves.toBe(true);
    });
    it('moveExpiredRecordToLanguageBucket writes the html under the language bucket, removes the expired file, and drops the record from records_expired.txt', async () => {
      await service.writeExpiredRecordDetail(
        '123',
        '<div>updated content</div>',
      );
      await service.appendExpiredRecord('123');
      await service.moveExpiredRecordToLanguageBucket(
        '123',
        'en',
        '<div>updated content</div>',
      );
      await expect(
        storage.read(service.recordDetailPath('en', '123')),
      ).resolves.toBe('<div>updated content</div>');
      expect(storage.files.has(service.expiredRecordDetailPath('123'))).toBe(
        false,
      );
      await expect(service.readExpiredRecordIds()).resolves.toEqual([]);
    });
    it('moveExpiredRecordToLanguageBucket records the record id in records_<languageAlpha2>.txt', async () => {
      await service.moveExpiredRecordToLanguageBucket(
        '123',
        'en',
        '<div>updated content</div>',
      );
      await expect(storage.read(service.recordsPath('en'))).resolves.toBe(
        '123\n',
      );
    });
    it('moveExpiredRecordToLanguageBucket migrates the record out of records_xx.txt when it lands under a real language', async () => {
      await service.appendRecordId('123', 'xx');
      await service.moveExpiredRecordToLanguageBucket(
        '123',
        'en',
        '<div>updated content</div>',
      );
      await expect(storage.read(service.recordsPath('xx'))).resolves.toBe('');
    });
    it('moveExpiredRecordToLanguageBucket writes to the xx bucket without touching records_xx.txt again when the language is still undetermined', async () => {
      await service.moveExpiredRecordToLanguageBucket(
        '123',
        'xx',
        '<div>ambiguous</div>',
      );
      await expect(
        storage.read(service.recordDetailPath('xx', '123')),
      ).resolves.toBe('<div>ambiguous</div>');
      await expect(storage.read(service.recordsPath('xx'))).resolves.toBe(
        '123\n',
      );
    });
  });
  describe('unknown language (xx) reprocessing', () => {
    it('readUnknownLanguageRecordIds returns an empty array when records_xx.txt does not exist', async () => {
      await expect(service.readUnknownLanguageRecordIds()).resolves.toEqual([]);
    });
    it('readUnknownLanguageRecordIds returns the trimmed, deduped, non-empty ids', async () => {
      storage.files.set(service.recordsPath('xx'), '111\n222\n\n111\n');
      await expect(service.readUnknownLanguageRecordIds()).resolves.toEqual([
        '111',
        '222',
      ]);
    });
    it('migrateOutOfUnknownLanguageBucket removes the record id from records_xx.txt and deletes its stale html', async () => {
      await service.appendRecordId('111', 'xx');
      await service.appendRecordId('222', 'xx');
      await service.writeRecordDetail('xx', '111', '<div>stale</div>');
      await service.migrateOutOfUnknownLanguageBucket('111');
      await expect(storage.read(service.recordsPath('xx'))).resolves.toBe(
        '222\n',
      );
      expect(storage.files.has(service.recordDetailPath('xx', '111'))).toBe(
        false,
      );
    });
    it('migrateOutOfUnknownLanguageBucket is a no-op when the record id was never recorded under xx', async () => {
      await service.appendRecordId('222', 'xx');
      await expect(
        service.migrateOutOfUnknownLanguageBucket('111'),
      ).resolves.toBeUndefined();
      await expect(storage.read(service.recordsPath('xx'))).resolves.toBe(
        '222\n',
      );
    });
    it('migrateOutOfUnknownLanguageBucket does nothing when records_xx.txt does not exist', async () => {
      await expect(
        service.migrateOutOfUnknownLanguageBucket('111'),
      ).resolves.toBeUndefined();
    });
    it('migrateOutOfUnknownLanguageBucket serializes concurrent calls so records_xx.txt does not lose an update', async () => {
      await service.appendRecordId('111', 'xx');
      await service.appendRecordId('222', 'xx');
      await service.appendRecordId('333', 'xx');
      await Promise.all([
        service.migrateOutOfUnknownLanguageBucket('111'),
        service.migrateOutOfUnknownLanguageBucket('222'),
      ]);
      await expect(storage.read(service.recordsPath('xx'))).resolves.toBe(
        '333\n',
      );
    });
  });
  describe('record titles extraction', () => {
    it('builds the raw record titles key under 2_record_titles/', () => {
      expect(service.rawRecordTitlesPath()).toBe(
        join('2_record_titles', '1_raw.txt'),
      );
    });
    it('listRecordDetailHtmlFiles returns an empty array when nothing has been written yet', async () => {
      await expect(service.listRecordDetailHtmlFiles()).resolves.toEqual([]);
    });
    it('listRecordDetailHtmlFiles returns an empty array when 1_records_raw/ has no entries', async () => {
      await service.appendSourceName('source-alpha');
      await expect(service.listRecordDetailHtmlFiles()).resolves.toEqual([]);
    });
    it('listRecordDetailHtmlFiles collects html files across every 1_records_raw/<alpha2>/ and 1_records_raw/expired/ key', async () => {
      await service.writeRecordDetail('en', '111', '<div>en 111</div>');
      await service.writeRecordDetail('en', '222', '<div>en 222</div>');
      await service.writeRecordDetail('pt', '333', '<div>pt 333</div>');
      await service.writeExpiredRecordDetail('444', '<div>expired 444</div>');
      const files = await service.listRecordDetailHtmlFiles();
      expect(files.sort()).toEqual(
        [
          service.recordDetailPath('en', '111'),
          service.recordDetailPath('en', '222'),
          service.recordDetailPath('pt', '333'),
          service.expiredRecordDetailPath('444'),
        ].sort(),
      );
    });
    it('listRecordDetailHtmlFiles ignores non-html keys inside 1_records_raw/<alpha2>/', async () => {
      await service.writeRecordDetail('en', '111', '<div>en 111</div>');
      storage.files.set(
        join('1_records_raw', 'en', 'notes.txt'),
        'not a record file',
      );
      await expect(service.listRecordDetailHtmlFiles()).resolves.toEqual([
        service.recordDetailPath('en', '111'),
      ]);
    });
    it('listRecordDetailHtmlFiles ignores records_<alpha2>.txt and records_expired.txt keys at the data dir root', async () => {
      await service.appendRecordId('111', 'en');
      await service.appendExpiredRecord('222');
      await expect(service.listRecordDetailHtmlFiles()).resolves.toEqual([]);
    });
    it('resetRawRecordTitlesFile creates an empty entry', async () => {
      await service.resetRawRecordTitlesFile();
      await expect(storage.read(service.rawRecordTitlesPath())).resolves.toBe(
        '',
      );
    });
    it("resetRawRecordTitlesFile discards an existing entry's contents", async () => {
      await service.appendRawRecordTitle('Widget Alpha');
      await service.resetRawRecordTitlesFile();
      await expect(storage.read(service.rawRecordTitlesPath())).resolves.toBe(
        '',
      );
    });
    it('appendRawRecordTitle appends one title per call', async () => {
      await service.appendRawRecordTitle('Widget Alpha');
      await service.appendRawRecordTitle('Widget Beta');
      await expect(storage.read(service.rawRecordTitlesPath())).resolves.toBe(
        'Widget Alpha\nWidget Beta\n',
      );
    });
    it('readRawRecordTitles returns an empty array when record_titles/1_raw.txt does not exist', async () => {
      await expect(service.readRawRecordTitles()).resolves.toEqual([]);
    });
    it('readRawRecordTitles returns trimmed, non-empty lines in file order', async () => {
      await service.appendRawRecordTitle('Widget Alpha');
      await service.appendRawRecordTitle('Widget Beta');
      await expect(service.readRawRecordTitles()).resolves.toEqual([
        'Widget Alpha',
        'Widget Beta',
      ]);
    });
    it('builds the dedup sorted record titles key under 2_record_titles/', () => {
      expect(service.dedupSortedRecordTitlesPath()).toBe(
        join('2_record_titles', '2_dedup_sorted.txt'),
      );
    });
    it('writeDedupSortedRecordTitles overwrites the entry with one title per line', async () => {
      await service.writeDedupSortedRecordTitles([
        'Widget Gamma',
        'Widget Alpha',
      ]);
      await service.writeDedupSortedRecordTitles(['Widget Beta']);
      await expect(
        storage.read(service.dedupSortedRecordTitlesPath()),
      ).resolves.toBe('Widget Beta\n');
    });
    it('readDedupSortedRecordTitles returns an empty array when record_titles/2_dedup_sorted.txt does not exist', async () => {
      await expect(service.readDedupSortedRecordTitles()).resolves.toEqual([]);
    });
    it('readDedupSortedRecordTitles returns trimmed, non-empty lines in file order', async () => {
      await service.writeDedupSortedRecordTitles([
        'Widget Gamma',
        'Widget Alpha',
      ]);
      await expect(service.readDedupSortedRecordTitles()).resolves.toEqual([
        'Widget Gamma',
        'Widget Alpha',
      ]);
    });
    it('builds the filtered record titles key under 2_record_titles/', () => {
      expect(service.filteredRecordTitlesPath()).toBe(
        join('2_record_titles', '3_filtered.txt'),
      );
    });
    it('writeFilteredRecordTitles overwrites the entry with one title per line', async () => {
      await service.writeFilteredRecordTitles(['Widget Gamma', 'Widget Alpha']);
      await service.writeFilteredRecordTitles(['Widget Beta']);
      await expect(
        storage.read(service.filteredRecordTitlesPath()),
      ).resolves.toBe('Widget Beta\n');
    });
    it('readFilteredRecordTitles returns an empty set when record_titles/3_filtered.txt does not exist', async () => {
      await expect(service.readFilteredRecordTitles()).resolves.toEqual(
        new Set(),
      );
    });
    it('readFilteredRecordTitles returns a set of trimmed, non-empty titles', async () => {
      await service.writeFilteredRecordTitles(['Widget Gamma', 'Widget Alpha']);
      await expect(service.readFilteredRecordTitles()).resolves.toEqual(
        new Set(['Widget Gamma', 'Widget Alpha']),
      );
    });
  });
  describe('3_records_filtered/', () => {
    it('builds the filtered record copy key under 3_records_filtered/<bucket>/', () => {
      expect(service.filteredRecordCopyPath('en', '111.html')).toBe(
        join('3_records_filtered', 'en', '111.html'),
      );
    });
    it('copyRecordDetailToFiltered copies the entry into 3_records_filtered/<bucket>/, preserving its filename', async () => {
      const sourceKey = join('1_records_raw', 'en', '111.html');
      storage.files.set(sourceKey, '<div>111</div>');
      const destKey = await service.copyRecordDetailToFiltered(sourceKey, 'en');
      expect(destKey).toBe(join('3_records_filtered', 'en', '111.html'));
      await expect(storage.read(destKey)).resolves.toBe('<div>111</div>');
      await expect(storage.read(sourceKey)).resolves.toBe('<div>111</div>');
    });
  });
});
