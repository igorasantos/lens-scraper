import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import Joi from 'joi';
import { ConfigService } from '@app/config';
export interface RecordDetailSelectors {
  recordFeature: string;
  bodyContent: string;
  sourceContent: string;
}
export interface SiteConfig {
  scrollFocusSelector: string;
  listing: {
    pageSize: number;
    containerSelector: string;
    containerTimeoutMs: number;
    cardSelector: string;
    cardIdAttribute: string;
    cardIdPrefix: string;
  };
  detail: {
    urlTemplate: string;
    sectionSelector: string;
    headerContainerSelector: string;
    featureSelector: string;
    bodySelectorTemplate: string;
    sourceSelectorTemplate: string;
    expiredMarker: string;
  };
  source: {
    urlPrefix: string;
  };
  auth?: {
    loginUrl: string;
  };
  sanitize: {
    stripAttributes: string[];
    stripElements: string[];
  };
  storage: {
    recordsFilenameTemplate: string;
    expiredRecordsFilename: string;
    unknownLanguageBucket: string;
    recordDetailRootDir: string;
    expiredRecordDetailDir: string;
    sourceDetailRootDir: string;
    recordTitlesRootDir: string;
    recordsFilteredRootDir: string;
    listingIdsFilename: string;
    rawListingIdsFilename: string;
    failuresLogFilename: string;
    sourcesFilename: string;
    recordTitlesRawFilename: string;
    recordTitlesDedupSortedFilename: string;
    recordTitlesFilteredFilename: string;
  };
}
const siteConfigSchema = Joi.object<SiteConfig>({
  scrollFocusSelector: Joi.string().required(),
  listing: Joi.object({
    pageSize: Joi.number().integer().positive().required(),
    containerSelector: Joi.string().required(),
    containerTimeoutMs: Joi.number().integer().positive().required(),
    cardSelector: Joi.string().required(),
    cardIdAttribute: Joi.string().required(),
    cardIdPrefix: Joi.string().required(),
  }).required(),
  detail: Joi.object({
    urlTemplate: Joi.string().required(),
    sectionSelector: Joi.string().required(),
    headerContainerSelector: Joi.string().required(),
    featureSelector: Joi.string().required(),
    bodySelectorTemplate: Joi.string().required(),
    sourceSelectorTemplate: Joi.string().required(),
    expiredMarker: Joi.string().required(),
  }).required(),
  source: Joi.object({
    urlPrefix: Joi.string().required(),
  }).required(),
  auth: Joi.object({
    loginUrl: Joi.string().required(),
  }).optional(),
  sanitize: Joi.object({
    stripAttributes: Joi.array().items(Joi.string()).required(),
    stripElements: Joi.array().items(Joi.string()).required(),
  }).required(),
  storage: Joi.object({
    recordsFilenameTemplate: Joi.string().required(),
    expiredRecordsFilename: Joi.string().required(),
    unknownLanguageBucket: Joi.string().required(),
    recordDetailRootDir: Joi.string().required(),
    expiredRecordDetailDir: Joi.string().required(),
    sourceDetailRootDir: Joi.string().required(),
    recordTitlesRootDir: Joi.string().required(),
    recordsFilteredRootDir: Joi.string().required(),
    listingIdsFilename: Joi.string().required(),
    rawListingIdsFilename: Joi.string().required(),
    failuresLogFilename: Joi.string().required(),
    sourcesFilename: Joi.string().required(),
    recordTitlesRawFilename: Joi.string().required(),
    recordTitlesDedupSortedFilename: Joi.string().required(),
    recordTitlesFilteredFilename: Joi.string().required(),
  }).required(),
});
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
  get scrollFocusSelector(): string {
    return this.config.scrollFocusSelector;
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
  get recordDetailSectionSelector(): string {
    return this.config.detail.sectionSelector;
  }
  get recordDetailHeaderContainerSelector(): string {
    return this.config.detail.headerContainerSelector;
  }
  get expiredRecordMarker(): string {
    return this.config.detail.expiredMarker;
  }
  get sourceUrlPrefix(): string {
    return this.config.source.urlPrefix;
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
  get recordsFilePattern(): RegExp {
    return buildRecordsFilePattern(this.config.storage.recordsFilenameTemplate);
  }
  recordsFilename(languageAlpha2: string): string {
    return this.config.storage.recordsFilenameTemplate.replace(
      '{lang}',
      languageAlpha2,
    );
  }
  get expiredRecordsFilename(): string {
    return this.config.storage.expiredRecordsFilename;
  }
  get unknownLanguageBucket(): string {
    return this.config.storage.unknownLanguageBucket;
  }
  get recordDetailRootDir(): string {
    return this.config.storage.recordDetailRootDir;
  }
  get expiredRecordDetailDir(): string {
    return this.config.storage.expiredRecordDetailDir;
  }
  get sourceDetailRootDir(): string {
    return this.config.storage.sourceDetailRootDir;
  }
  get recordTitlesRootDir(): string {
    return this.config.storage.recordTitlesRootDir;
  }
  get recordsFilteredRootDir(): string {
    return this.config.storage.recordsFilteredRootDir;
  }
  get listingIdsFilename(): string {
    return this.config.storage.listingIdsFilename;
  }
  get rawListingIdsFilename(): string {
    return this.config.storage.rawListingIdsFilename;
  }
  get failuresLogFilename(): string {
    return this.config.storage.failuresLogFilename;
  }
  get sourcesFilename(): string {
    return this.config.storage.sourcesFilename;
  }
  get recordTitlesRawFilename(): string {
    return this.config.storage.recordTitlesRawFilename;
  }
  get recordTitlesDedupSortedFilename(): string {
    return this.config.storage.recordTitlesDedupSortedFilename;
  }
  get recordTitlesFilteredFilename(): string {
    return this.config.storage.recordTitlesFilteredFilename;
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
