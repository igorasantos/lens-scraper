import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import Joi from 'joi';
import { ConfigService } from '@app/config';
import type { BrowserContextKind } from '@app/browser';
export interface RecordDetailSelectors {
  recordFeature: string;
  bodyContent: string;
  sourceContent: string;
}
export interface SiteConfig {
  listing: {
    browserContext: BrowserContextKind;
    scrollFocusSelector: string;
    pageSize: number;
    containerSelector: string;
    containerTimeoutMs: number;
    cardSelector: string;
    cardIdAttribute: string;
    cardIdPrefix: string;
  };
  detail: {
    browserContext: BrowserContextKind;
    scrollFocusSelector: string;
    urlTemplate: string;
    sectionSelector: string;
    headerSelector: string;
    titleSelector: string;
    featureSelector: string;
    bodySelectorTemplate: string;
    sourceSelectorTemplate: string;
    expiredMarker: string;
  };
  source: {
    urlPrefix: string;
    detailSelector?: string;
    detailTimeoutMs: number;
  };
  auth?: {
    loginUrl: string;
  };
  sanitize: {
    stripAttributes: string[];
    stripElements: string[];
  };
  storage: {
    scrapedRecordsFilenameTemplate: string;
    expiredScrapedRecordsFile: string;
    unknownLanguageBucket: string;
    scrapedRecordDetailsDir: string;
    recordDetailCatalogDir: string;
    expiredScrapedRecordsDir: string;
    sourceDetailDir: string;
    recordTitlesDir: string;
    recordsFilteredDir: string;
    listingIdsFile: string;
    rawListingIdsFile: string;
    listingRecycledIdsFile: string;
    listingIdsToScrapeFile: string;
    failuresLogFile: string;
    sourcesFile: string;
    rawRecordTitlesFile: string;
    dedupSortedRecordTitlesFile: string;
    filteredRecordTitlesFile: string;
    deadLetterDir: string;
    deadLetterRecordIdsFilenameTemplate: string;
    deadLetterPayloadsFilenameTemplate: string;
  };
}
const browserContextSchema = Joi.string()
  .valid('persistent', 'ephemeral')
  .default('persistent');
const siteConfigSchema = Joi.object<SiteConfig>({
  listing: Joi.object({
    browserContext: browserContextSchema,
    scrollFocusSelector: Joi.string().required(),
    pageSize: Joi.number().integer().positive().required(),
    containerSelector: Joi.string().required(),
    containerTimeoutMs: Joi.number().integer().positive().required(),
    cardSelector: Joi.string().required(),
    cardIdAttribute: Joi.string().required(),
    cardIdPrefix: Joi.string().required(),
  }).required(),
  detail: Joi.object({
    browserContext: browserContextSchema,
    scrollFocusSelector: Joi.string().required(),
    urlTemplate: Joi.string().required(),
    sectionSelector: Joi.string().required(),
    headerSelector: Joi.string().required(),
    titleSelector: Joi.string().required(),
    featureSelector: Joi.string().required(),
    bodySelectorTemplate: Joi.string().required(),
    sourceSelectorTemplate: Joi.string().required(),
    expiredMarker: Joi.string().required(),
  }).required(),
  source: Joi.object({
    urlPrefix: Joi.string().required(),
    detailSelector: Joi.string().optional(),
    detailTimeoutMs: Joi.number().integer().positive().default(10000),
  }).required(),
  auth: Joi.object({
    loginUrl: Joi.string().required(),
  }).optional(),
  sanitize: Joi.object({
    stripAttributes: Joi.array().items(Joi.string()).required(),
    stripElements: Joi.array().items(Joi.string()).required(),
  }).required(),
  storage: Joi.object({
    scrapedRecordsFilenameTemplate: Joi.string().required(),
    expiredScrapedRecordsFile: Joi.string().required(),
    unknownLanguageBucket: Joi.string().required(),
    scrapedRecordDetailsDir: Joi.string().required(),
    recordDetailCatalogDir: Joi.string().required(),
    expiredScrapedRecordsDir: Joi.string().required(),
    sourceDetailDir: Joi.string().required(),
    recordTitlesDir: Joi.string().required(),
    recordsFilteredDir: Joi.string().required(),
    listingIdsFile: Joi.string().required(),
    rawListingIdsFile: Joi.string().required(),
    listingRecycledIdsFile: Joi.string().required(),
    listingIdsToScrapeFile: Joi.string().required(),
    failuresLogFile: Joi.string().required(),
    sourcesFile: Joi.string().required(),
    rawRecordTitlesFile: Joi.string().required(),
    dedupSortedRecordTitlesFile: Joi.string().required(),
    filteredRecordTitlesFile: Joi.string().required(),
    deadLetterDir: Joi.string().required(),
    deadLetterRecordIdsFilenameTemplate: Joi.string()
      .pattern(/\{topic\}/)
      .required(),
    deadLetterPayloadsFilenameTemplate: Joi.string()
      .pattern(/\{topic\}/)
      .required(),
  }).required(),
}).pattern(/^_/, Joi.any());
function fillTemplate(template: string, recordId: string): string {
  return template.replace('{id}', recordId);
}
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildRecordsFilePattern(template: string): RegExp {
  const [prefix, suffix] = template.split('{lang}');
  return new RegExp(`^${escapeRegExp(prefix)}(.+)${escapeRegExp(suffix)}$`);
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class SiteConfigService {
  private readonly config: SiteConfig;
  constructor(config: ConfigService) {
    this.config = loadSiteConfig(config.siteConfigPath);
  }
  get listingBrowserContext(): BrowserContextKind {
    return this.config.listing.browserContext;
  }
  get listingScrollFocusSelector(): string {
    return this.config.listing.scrollFocusSelector;
  }
  get listingPageSize(): number {
    return this.config.listing.pageSize;
  }
  get listingContainerSelector(): string {
    return this.config.listing.containerSelector;
  }
  get listingContainerTimeoutMs(): number {
    return this.config.listing.containerTimeoutMs;
  }
  get recordCardSelector(): string {
    return this.config.listing.cardSelector;
  }
  get recordCardIdAttribute(): string {
    return this.config.listing.cardIdAttribute;
  }
  get recordCardIdPrefix(): string {
    return this.config.listing.cardIdPrefix;
  }
  get recordDetailBrowserContext(): BrowserContextKind {
    return this.config.detail.browserContext;
  }
  get recordDetailScrollFocusSelector(): string {
    return this.config.detail.scrollFocusSelector;
  }
  get recordDetailSectionSelector(): string {
    return this.config.detail.sectionSelector;
  }
  get recordDetailHeaderSelector(): string {
    return this.config.detail.headerSelector;
  }
  get recordTitleSelector(): string {
    return this.config.detail.titleSelector;
  }
  get expiredRecordMarker(): string {
    return this.config.detail.expiredMarker;
  }
  get sourceUrlPrefix(): string {
    return this.config.source.urlPrefix;
  }
  get sourceDetailSelector(): string | undefined {
    return this.config.source.detailSelector;
  }
  get sourceDetailTimeoutMs(): number {
    return this.config.source.detailTimeoutMs;
  }
  get loginUrl(): string | undefined {
    return this.config.auth?.loginUrl;
  }
  get sanitizeStripAttributes(): string[] {
    return this.config.sanitize.stripAttributes;
  }
  get sanitizeStripElements(): string[] {
    return this.config.sanitize.stripElements;
  }
  get scrapedRecordsFilePattern(): RegExp {
    return buildRecordsFilePattern(
      this.config.storage.scrapedRecordsFilenameTemplate,
    );
  }
  scrapedRecordsFilename(languageAlpha2: string): string {
    return this.config.storage.scrapedRecordsFilenameTemplate.replace(
      '{lang}',
      languageAlpha2,
    );
  }
  get expiredScrapedRecordsFile(): string {
    return this.config.storage.expiredScrapedRecordsFile;
  }
  get unknownLanguageBucket(): string {
    return this.config.storage.unknownLanguageBucket;
  }
  get scrapedRecordDetailsDir(): string {
    return this.config.storage.scrapedRecordDetailsDir;
  }
  get recordDetailCatalogDir(): string {
    return this.config.storage.recordDetailCatalogDir;
  }
  get expiredScrapedRecordsDir(): string {
    return this.config.storage.expiredScrapedRecordsDir;
  }
  get sourceDetailDir(): string {
    return this.config.storage.sourceDetailDir;
  }
  get recordTitlesDir(): string {
    return this.config.storage.recordTitlesDir;
  }
  get recordsFilteredDir(): string {
    return this.config.storage.recordsFilteredDir;
  }
  get listingIdsFile(): string {
    return this.config.storage.listingIdsFile;
  }
  get rawListingIdsFile(): string {
    return this.config.storage.rawListingIdsFile;
  }
  get listingRecycledIdsFile(): string {
    return this.config.storage.listingRecycledIdsFile;
  }
  get listingIdsToScrapeFile(): string {
    return this.config.storage.listingIdsToScrapeFile;
  }
  get failuresLogFile(): string {
    return this.config.storage.failuresLogFile;
  }
  get sourcesFile(): string {
    return this.config.storage.sourcesFile;
  }
  get rawRecordTitlesFile(): string {
    return this.config.storage.rawRecordTitlesFile;
  }
  get dedupSortedRecordTitlesFile(): string {
    return this.config.storage.dedupSortedRecordTitlesFile;
  }
  get filteredRecordTitlesFile(): string {
    return this.config.storage.filteredRecordTitlesFile;
  }
  get deadLetterDir(): string {
    return this.config.storage.deadLetterDir;
  }
  deadLetterRecordIdsFilename(topic: string): string {
    return this.config.storage.deadLetterRecordIdsFilenameTemplate.replace(
      '{topic}',
      topic,
    );
  }
  deadLetterPayloadsFilename(topic: string): string {
    return this.config.storage.deadLetterPayloadsFilenameTemplate.replace(
      '{topic}',
      topic,
    );
  }
  buildRecordDetailUrl(recordId: string): string {
    return fillTemplate(this.config.detail.urlTemplate, recordId);
  }
  buildRecordDetailSelectors(recordId: string): RecordDetailSelectors {
    return {
      recordFeature: fillTemplate(this.config.detail.featureSelector, recordId),
      bodyContent: fillTemplate(
        this.config.detail.bodySelectorTemplate,
        recordId,
      ),
      sourceContent: fillTemplate(
        this.config.detail.sourceSelectorTemplate,
        recordId,
      ),
    };
  }
}
export function loadSiteConfig(path: string): SiteConfig {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  const { error, value } = siteConfigSchema.validate(raw, {
    abortEarly: false,
  });
  if (error) {
    throw new Error(`Invalid site config at ${path}: ${error.message}`);
  }
  return value;
}
