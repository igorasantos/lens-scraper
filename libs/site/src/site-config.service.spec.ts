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
    recordsFilenameTemplate: 'records_{lang}.txt',
    expiredRecordsFilename: 'records_expired.txt',
    unknownLanguageBucket: 'xx',
    recordDetailRootDir: '1_records_raw',
    recordDetailCatalogDir: '1_records_catalog',
    expiredRecordDetailDir: 'expired',
    sourceDetailRootDir: '0_sources',
    recordTitlesRootDir: '2_record_titles',
    recordsFilteredRootDir: '3_records_filtered',
    listingIdsFilename: 'listing-ids.txt',
    rawListingIdsFilename: 'raw_listing_ids.txt',
    listingIdsFilenameRecycled: 'listing-ids-recycled.txt',
    listingIdsFilenameToScrape: 'listing-ids-to-scrape.txt',
    failuresLogFilename: 'failures.log',
    sourcesFilename: 'sources.txt',
    recordTitlesRawFilename: '1_raw.txt',
    recordTitlesDedupSortedFilename: '2_dedup_sorted.txt',
    recordTitlesFilteredFilename: '3_filtered.txt',
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
    expect(service.expiredRecordsFilename).toBe('records_expired.txt');
    expect(service.unknownLanguageBucket).toBe('xx');
    expect(service.recordDetailRootDir).toBe('1_records_raw');
    expect(service.recordDetailCatalogDir).toBe('1_records_catalog');
    expect(service.expiredRecordDetailDir).toBe('expired');
    expect(service.sourceDetailRootDir).toBe('0_sources');
    expect(service.recordTitlesRootDir).toBe('2_record_titles');
    expect(service.recordsFilteredRootDir).toBe('3_records_filtered');
    expect(service.listingIdsFilename).toBe('listing-ids.txt');
    expect(service.rawListingIdsFilename).toBe('raw_listing_ids.txt');
    expect(service.listingIdsFilenameRecycled).toBe('listing-ids-recycled.txt');
    expect(service.listingIdsFilenameToScrape).toBe(
      'listing-ids-to-scrape.txt',
    );
    expect(service.failuresLogFilename).toBe('failures.log');
    expect(service.sourcesFilename).toBe('sources.txt');
    expect(service.recordTitlesRawFilename).toBe('1_raw.txt');
    expect(service.recordTitlesDedupSortedFilename).toBe('2_dedup_sorted.txt');
    expect(service.recordTitlesFilteredFilename).toBe('3_filtered.txt');
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
    expect(service.recordsFilename('en')).toBe('records_en.txt');
  });
  it('derives a matching pattern from recordsFilenameTemplate', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.recordsFilePattern.test('records_en.txt')).toBe(true);
    expect(service.recordsFilePattern.test('records_expired.txt')).toBe(true);
    expect(service.recordsFilePattern.test('other.txt')).toBe(false);
    expect('records_pt.txt'.match(service.recordsFilePattern)?.[1]).toBe('pt');
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
