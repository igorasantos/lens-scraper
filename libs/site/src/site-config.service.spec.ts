import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SiteConfigService, loadSiteConfig } from './site-config.service.js';
import type { ConfigService } from '@app/config';
const validConfig = {
  listing_logged_in: {
    scrollFocusSelector: '#app',
    pageSize: 25,
    containerSelector: '[data-testid="results-container"]',
    containerTimeoutMs: 10000,
    cardSelector: 'div[data-testid^="record-card-"]',
    cardIdAttribute: 'data-testid',
    cardIdPrefix: 'record-card-',
  },
  listing_logged_out: {
    containerSelector: 'ol.entries',
    containerTimeoutMs: 5000,
    cardSelector: 'ol.entries [data-entity-key]',
    cardIdAttribute: 'data-entity-key',
    cardIdPrefix: 'entity:',
  },
  detail_logged_in: {
    scrollFocusSelector: '#app',
    urlTemplate: 'https://example.com/item/{id}',
    sectionSelector: 'article section',
    headerSelector: 'div.summary',
    titleSelector: 'p',
    featureSelector: 'div[data-testid="feature-{id}"]',
    bodySelectorTemplate: 'div[data-testid="body-{id}"]',
    sourceSelectorTemplate: 'div[data-testid="source-{id}"]',
    sourceLinkSelector: 'div.summary a',
    expiredMarker: 'not available',
  },
  detail_logged_out: {
    scrollFocusSelector: 'body',
    urlTemplate: 'https://example.com/{id}',
    sectionSelector: 'section',
    headerSelector: 'div[data-testid="header"]',
    titleSelector: 'h1',
    featureSelector: 'div[data-testid="feature"]',
    bodySelectorTemplate: 'div[data-testid="body"]',
    sourceSelectorTemplate: 'div[data-testid="source"]',
    sourceDetailSelector: 'section[data-testid="detail"]',
    sourceDetailTimeoutMs: 5000,
    expiredMarker: 'not available',
  },
  source: {
    urlPrefix: 'https://example.com/source/',
  },
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
    expect(service.loggedInListing.pageSize).toBe(25);
    expect(service.listingSelectors('logged-in').containerSelector).toBe(
      '[data-testid="results-container"]',
    );
    expect(service.sourceUrlPrefix).toBe('https://example.com/source/');
    expect(service.loginUrl).toBe('https://example.com/login');
  });
  it('exposes every configured selector and storage filename getter', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
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
  it('exposes the logged-in listing block, with its paging and scroll settings', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.loggedInListing).toEqual(validConfig.listing_logged_in);
    expect(service.listingSelectors('logged-in')).toBe(service.loggedInListing);
  });
  it('picks the listing selectors block by session mode', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.listingSelectors('logged-out')).toEqual(
      validConfig.listing_logged_out,
    );
  });
  it('picks the detail block by session mode', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.detail('logged-in')).toEqual({
      ...validConfig.detail_logged_in,
      sourceDetailTimeoutMs: 10000,
    });
    expect(service.detail('logged-out')).toEqual(validConfig.detail_logged_out);
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
  it('fills the {id} placeholder when building the record detail url of each mode', async () => {
    const path = await writeConfig(validConfig);
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.buildRecordDetailUrl('123', 'logged-in')).toBe(
      'https://example.com/item/123',
    );
    expect(service.buildRecordDetailUrl('123', 'logged-out')).toBe(
      'https://example.com/123',
    );
  });
  it('fills the {id} placeholder in every detail selector template of the given mode', async () => {
    const path = await writeConfig({
      ...validConfig,
      detail_logged_in: {
        ...validConfig.detail_logged_in,
        bodySelectorTemplate: 'div.body-{id}',
      },
    });
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.buildRecordDetailSelectors('123', 'logged-in')).toEqual({
      recordFeature: 'div[data-testid="feature-123"]',
      bodyContent: 'div.body-123',
      sourceContent: 'div[data-testid="source-123"]',
    });
    expect(service.buildRecordDetailSelectors('123', 'logged-out')).toEqual({
      recordFeature: 'div[data-testid="feature"]',
      bodyContent: 'div[data-testid="body"]',
      sourceContent: 'div[data-testid="source"]',
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
  it('defaults the source detail page to absent with a 10s timeout', async () => {
    const {
      sourceDetailSelector: _selector,
      sourceDetailTimeoutMs: _timeout,
      ...detail
    } = validConfig.detail_logged_out;
    const path = await writeConfig({
      ...validConfig,
      detail_logged_out: detail,
    });
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.detail('logged-out').sourceDetailSelector).toBeUndefined();
    expect(service.detail('logged-out').sourceDetailTimeoutMs).toBe(10000);
  });
  it('rejects paging and scroll settings in the logged-out listing block', async () => {
    const path = await writeConfig({
      ...validConfig,
      listing_logged_out: { ...validConfig.listing_logged_out, pageSize: 25 },
    });
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /"listing_logged_out.pageSize" is not allowed/,
    );
  });
  it('rejects the old single listing and detail blocks', async () => {
    const path = await writeConfig({
      ...validConfig,
      listing: validConfig.listing_logged_in,
    });
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /"listing" is not allowed/,
    );
  });
  it('validates the example config shipped with the repo', () => {
    expect(() =>
      loadSiteConfig(
        join(import.meta.dirname, '../../../config/site.config.example.json'),
      ),
    ).not.toThrow();
  });
  it('ignores top-level keys prefixed with an underscore', async () => {
    const path = await writeConfig({
      ...validConfig,
      _detail_backup: { anything: 'goes' },
    });
    const service = new SiteConfigService(fakeConfigService(path));
    expect(service.detail('logged-out').sectionSelector).toBe('section');
  });
  it('throws on an unknown top-level key without the underscore prefix', async () => {
    const path = await writeConfig({ ...validConfig, detail_backup: {} });
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /"detail_backup" is not allowed/,
    );
  });
  it('throws when the config file is missing a required field', async () => {
    const { listing_logged_out: _listing, ...withoutListing } = validConfig;
    const path = await writeConfig(withoutListing);
    expect(() => new SiteConfigService(fakeConfigService(path))).toThrow(
      /Invalid site config/,
    );
  });
  it('throws when the config file does not exist', () => {
    expect(() => loadSiteConfig(join(dir, 'missing.json'))).toThrow();
  });
});
