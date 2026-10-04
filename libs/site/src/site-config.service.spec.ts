import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SiteConfigService, loadSiteConfig } from './site-config.service.js';
import type { ConfigService } from '@app/config';
const validConfig = {
  scrollFocusSelector: '#app',
  listing: {
    pageSize: 25,
    containerSelector: '[data-testid="results-container"]',
    containerTimeoutMs: 10000,
    cardSelector: 'div[data-testid^="record-card-"]',
    cardIdAttribute: 'data-testid',
    cardIdPrefix: 'record-card-',
  },
  detail: {
    urlTemplate: 'https://example.com/{id}',
    sectionSelector: 'section',
    headerContainerSelector: 'div[data-testid="header"]',
    featureSelector: 'div[data-testid="feature-{id}"]',
    bodySelectorTemplate: 'div[data-testid="body-{id}"]',
    sourceSelectorTemplate: 'div[data-testid="source-{id}"]',
    expiredMarker: 'not available',
  },
  source: { urlPrefix: 'https://example.com/source/' },
  auth: { loginUrl: 'https://example.com/login' },
  sanitize: {
    stripAttributes: ['class'],
    stripElements: ['script'],
  },
  storage: {
    scrapedRecordsFilenameTemplate: 'scraped_records_{lang}.txt',
    expiredScrapedRecordsFile: 'scraped_records_expired.txt',
    unknownLanguageBucket: 'xx',
    scrapedRecordDetailsDir: '1_records_raw',
    recordDetailCatalogDir: '1_records_catalog',
    expiredScrapedRecordsDir: 'expired',
    sourceDetailDir: '0_sources',
    recordTitlesDir: '2_record_titles',
    recordsFilteredDir: '3_records_filtered',
    listingIdsFile: 'listing_ids_new.txt',
    rawListingIdsFile: 'raw_listing_ids.txt',
    listingRecycledIdsFile: 'listing_ids_recycled.txt',
    listingIdsToScrapeFile: 'listing_ids_to_scrape.txt',
    failuresLogFile: 'failures.log',
    sourcesFile: 'sources.txt',
    rawRecordTitlesFile: '1_raw.txt',
    dedupSortedRecordTitlesFile: '2_dedup_sorted.txt',
    filteredRecordTitlesFile: '3_filtered.txt',
    deadLetterDir: 'dlq',
    deadLetterRecordIdsFilenameTemplate: '{topic}.txt',
    deadLetterPayloadsFilenameTemplate: '{topic}.jsonl',
  },
};
describe('SiteConfigService', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'site-config-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  async function writeConfig(contents: unknown): Promise<string> {
    const path = join(dir, 'site.config.json');
    await writeFile(path, JSON.stringify(contents));
    return path;
  }
  function fakeConfigService(siteConfigPath: string): ConfigService {
    return { siteConfigPath } as unknown as ConfigService;
  }
  it('loads and exposes the configured selectors', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.listingPageSize).toBe(25);
    expect(service.listingContainerSelector).toBe(
      '[data-testid="results-container"]',
    );
    expect(service.sourceUrlPrefix).toBe('https://example.com/source/');
    expect(service.loginUrl).toBe('https://example.com/login');
  });
  it('exposes every configured selector and storage filename getter', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.scrollFocusSelector).toBe('#app');
    expect(service.listingContainerTimeoutMs).toBe(10000);
    expect(service.recordCardSelector).toBe('div[data-testid^="record-card-"]');
    expect(service.recordCardIdAttribute).toBe('data-testid');
    expect(service.recordCardIdPrefix).toBe('record-card-');
    expect(service.recordDetailSectionSelector).toBe('section');
    expect(service.recordDetailHeaderContainerSelector).toBe(
      'div[data-testid="header"]',
    );
    expect(service.expiredRecordMarker).toBe('not available');
    expect(service.sanitizeStripAttributes).toEqual(['class']);
    expect(service.sanitizeStripElements).toEqual(['script']);
    expect(service.expiredScrapedRecordsFile).toBe(
      'scraped_records_expired.txt',
    );
    expect(service.unknownLanguageBucket).toBe('xx');
    expect(service.scrapedRecordDetailsDir).toBe('1_records_raw');
    expect(service.recordDetailCatalogDir).toBe('1_records_catalog');
    expect(service.expiredScrapedRecordsDir).toBe('expired');
    expect(service.sourceDetailDir).toBe('0_sources');
    expect(service.recordTitlesDir).toBe('2_record_titles');
    expect(service.recordsFilteredDir).toBe('3_records_filtered');
    expect(service.listingIdsFile).toBe('listing_ids_new.txt');
    expect(service.rawListingIdsFile).toBe('raw_listing_ids.txt');
    expect(service.listingRecycledIdsFile).toBe('listing_ids_recycled.txt');
    expect(service.listingIdsToScrapeFile).toBe('listing_ids_to_scrape.txt');
    expect(service.failuresLogFile).toBe('failures.log');
    expect(service.sourcesFile).toBe('sources.txt');
    expect(service.rawRecordTitlesFile).toBe('1_raw.txt');
    expect(service.dedupSortedRecordTitlesFile).toBe('2_dedup_sorted.txt');
    expect(service.filteredRecordTitlesFile).toBe('3_filtered.txt');
    expect(service.deadLetterDir).toBe('dlq');
  });
  it('fills the {topic} placeholder in both dead-letter filename templates', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.deadLetterRecordIdsFilename('scrape.record.detail')).toBe(
      'scrape.record.detail.txt',
    );
    expect(service.deadLetterPayloadsFilename('scrape.listing.init')).toBe(
      'scrape.listing.init.jsonl',
    );
  });
  it('throws when a dead-letter filename template lacks the {topic} placeholder', async () => {
    const path = await writeConfig({
      ...validConfig,
      storage: {
        ...validConfig.storage,
        deadLetterPayloadsFilenameTemplate: 'dlq.jsonl',
      },
    });
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /deadLetterPayloadsFilenameTemplate/,
    );
  });
  it('fills the {id} placeholder when building the record detail url', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.buildRecordDetailUrl('123')).toBe('https://example.com/123');
  });
  it('fills the {id} placeholder in every detail selector template', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.buildRecordDetailSelectors('123')).toEqual({
      recordFeature: 'div[data-testid="feature-123"]',
      bodyContent: 'div[data-testid="body-123"]',
      sourceContent: 'div[data-testid="source-123"]',
    });
  });
  it('derives the records filename from the language alpha2 code', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.scrapedRecordsFilename('en')).toBe('scraped_records_en.txt');
  });
  it('derives a matching pattern from scrapedRecordsFilenameTemplate', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(
      service.scrapedRecordsFilePattern.test('scraped_records_en.txt'),
    ).toBe(true);
    expect(
      service.scrapedRecordsFilePattern.test('scraped_records_expired.txt'),
    ).toBe(true);
    expect(service.scrapedRecordsFilePattern.test('other.txt')).toBe(false);
    expect(
      'scraped_records_pt.txt'.match(service.scrapedRecordsFilePattern)?.[1],
    ).toBe('pt');
  });
  it('allows omitting auth for sites that need no login', async () => {
    const { auth: _auth, ...withoutAuth } = validConfig;
    const path = await writeConfig(withoutAuth);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.loginUrl).toBeUndefined();
  });
  it('throws when the config file is missing a required field', async () => {
    const { listing: _listing, ...withoutListing } = validConfig;
    const path = await writeConfig(withoutListing);
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /Invalid site config/,
    );
  });
  it('throws when the config file does not exist', () => {
    expect(() => loadSiteConfig(join(dir, 'missing.json'))).toThrow();
  });
});
