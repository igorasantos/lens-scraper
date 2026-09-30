import { Inject, Injectable, Logger } from '@nestjs/common';
import { basename, join } from 'node:path';
import { ConfigService } from '@app/config';
import { SiteConfigService } from '@app/site';
import { LOCK_KEY_PREFIX, LOCK_PORT, type LockPort } from '@app/redis-lock';
import { STORAGE_PORT } from './storage-port.token.js';
import type { StoragePort } from './storage.port.js';
export interface FailureLogEntry {
  recordId: string;
  reason: string;
  attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  constructor(
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    private readonly siteConfig: SiteConfigService,
    @Inject(LOCK_PORT)
    private readonly lock: LockPort,
    private readonly config: ConfigService,
  ) {}
  private async readLines(
    key: string,
    options: { notFoundError?: string } = {},
  ): Promise<string[]> {
    let contents: string;
    try {
      contents = await this.storage.read(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (options.notFoundError) {
          throw new Error(options.notFoundError);
        }
        return [];
      }
      throw error;
    }
    return contents
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  private async withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `${LOCK_KEY_PREFIX}:file-lock:${key}`;
    const deadline = Date.now() + this.config.fileLockMaxWaitMs;
    let token: string | null = null;
    for (;;) {
      token = await this.lock.acquire(lockKey, this.config.fileLockTtlMs);
      if (token) {
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for file lock: ${lockKey}`);
      }
      await sleep(this.config.fileLockRetryIntervalMs);
    }
    try {
      return await fn();
    } finally {
      await this.lock.release(lockKey, token);
    }
  }
  async read(key: string): Promise<string> {
    return this.storage.read(key);
  }
  listingIdsPath(runId: string): string {
    return join('runs', runId, this.siteConfig.listingIdsFilename);
  }
  rawListingIdsPath(runId: string): string {
    return join('runs', runId, this.siteConfig.rawListingIdsFilename);
  }
  recordsPath(languageAlpha2: string): string {
    return this.siteConfig.recordsFilename(languageAlpha2);
  }
  sourcesPath(): string {
    return this.siteConfig.sourcesFilename;
  }
  sourceDetailPath(name: string): string {
    return join(this.siteConfig.sourceDetailRootDir, `${name}.html`);
  }
  recordDetailPath(languageAlpha2: string, recordId: string): string {
    return join(
      this.siteConfig.recordDetailRootDir,
      languageAlpha2,
      `${recordId}.html`,
    );
  }
  expiredRecordDetailPath(recordId: string): string {
    return join(
      this.siteConfig.recordDetailRootDir,
      this.siteConfig.expiredRecordDetailDir,
      `${recordId}.html`,
    );
  }
  failuresLogPath(runId: string): string {
    return join('runs', runId, this.siteConfig.failuresLogFilename);
  }
  expiredRecordsPath(): string {
    return this.siteConfig.expiredRecordsFilename;
  }
  rawRecordTitlesPath(): string {
    return join(
      this.siteConfig.recordTitlesRootDir,
      this.siteConfig.recordTitlesRawFilename,
    );
  }
  dedupSortedRecordTitlesPath(): string {
    return join(
      this.siteConfig.recordTitlesRootDir,
      this.siteConfig.recordTitlesDedupSortedFilename,
    );
  }
  filteredRecordTitlesPath(): string {
    return join(
      this.siteConfig.recordTitlesRootDir,
      this.siteConfig.recordTitlesFilteredFilename,
    );
  }
  async appendRawListingIds(runId: string, recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) {
      return;
    }
    const key = this.rawListingIdsPath(runId);
    await this.storage.append(key, recordIds.map((id) => `${id}\n`).join(''));
    this.logger.debug(`Appended ${recordIds.length} record id(s) to ${key}`);
  }
  async readRawListingIds(runId: string): Promise<string[]> {
    const key = this.rawListingIdsPath(runId);
    return this.readLines(key, {
      notFoundError: `No raw_listing_ids.txt found for run ${runId} (${key})`,
    });
  }
  async writeListingIds(runId: string, recordIds: string[]): Promise<void> {
    const key = this.listingIdsPath(runId);
    await this.storage.write(key, recordIds.map((id) => `${id}\n`).join(''));
    this.logger.debug(`Wrote ${recordIds.length} record id(s) to ${key}`);
  }
  async readRecordIds(): Promise<Set<string>> {
    const entries = await this.storage.list('', { recursive: false });
    const recordIds = new Set<string>();
    for (const entry of entries) {
      if (
        entry === this.siteConfig.expiredRecordsFilename ||
        !this.siteConfig.recordsFilePattern.test(entry)
      ) {
        continue;
      }
      const contents = await this.storage.read(entry);
      for (const line of contents.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) {
          recordIds.add(trimmed);
        }
      }
    }
    return recordIds;
  }
  async writeRecordDetail(
    languageAlpha2: string,
    recordId: string,
    html: string,
  ): Promise<void> {
    const key = this.recordDetailPath(languageAlpha2, recordId);
    await this.storage.write(key, html);
    this.logger.debug(`Wrote record detail for ${recordId} to ${key}`);
  }
  async appendRecordId(
    recordId: string,
    languageAlpha2: string,
  ): Promise<void> {
    await this.storage.append(
      this.recordsPath(languageAlpha2),
      `${recordId}\n`,
    );
  }
  async readSourceNames(): Promise<Set<string>> {
    return new Set(await this.readLines(this.sourcesPath()));
  }
  async appendSourceName(name: string): Promise<boolean> {
    const key = this.sourcesPath();
    return this.withFileLock(key, async () => {
      const existing = await this.readSourceNames();
      if (existing.has(name)) {
        return false;
      }
      await this.storage.append(key, `${name}\n`);
      return true;
    });
  }
  async writeSourceDetail(name: string, html: string): Promise<void> {
    const key = this.sourceDetailPath(name);
    await this.storage.write(key, html);
    this.logger.debug(`Wrote source detail for ${name} to ${key}`);
  }
  async readExpiredRecordIds(): Promise<string[]> {
    return [...new Set(await this.readLines(this.expiredRecordsPath()))];
  }
  async appendExpiredRecord(recordId: string): Promise<void> {
    const key = this.expiredRecordsPath();
    await this.withFileLock(key, async () => {
      const existing = await this.readExpiredRecordIds();
      if (existing.includes(recordId)) {
        return;
      }
      await this.storage.append(key, `${recordId}\n`);
      this.logger.debug(`Appended expired record ${recordId} to ${key}`);
    });
  }
  async removeExpiredRecord(recordId: string): Promise<boolean> {
    const key = this.expiredRecordsPath();
    return this.withFileLock(key, async () => {
      const existing = await this.readExpiredRecordIds();
      if (!existing.includes(recordId)) {
        return false;
      }
      const remaining = existing.filter((id) => id !== recordId);
      await this.storage.write(key, remaining.map((id) => `${id}\n`).join(''));
      this.logger.debug(`Removed expired record ${recordId} from ${key}`);
      return true;
    });
  }
  async writeExpiredRecordDetail(
    recordId: string,
    html: string,
  ): Promise<void> {
    const key = this.expiredRecordDetailPath(recordId);
    await this.storage.write(key, html);
    this.logger.debug(`Wrote expired record detail for ${recordId} to ${key}`);
  }
  async hasExpiredRecordDetail(recordId: string): Promise<boolean> {
    return this.storage.exists(this.expiredRecordDetailPath(recordId));
  }
  async moveExpiredRecordToLanguageBucket(
    recordId: string,
    languageAlpha2: string,
    html: string,
  ): Promise<void> {
    await this.writeRecordDetail(languageAlpha2, recordId, html);
    await this.storage.remove(this.expiredRecordDetailPath(recordId));
    await this.removeExpiredRecord(recordId);
    await this.appendRecordId(recordId, languageAlpha2);
    if (languageAlpha2 !== this.siteConfig.unknownLanguageBucket) {
      await this.migrateOutOfUnknownLanguageBucket(recordId);
    }
    this.logger.log(
      `Moved record detail for ${recordId} out of expired into '${languageAlpha2}'`,
    );
  }
  async readUnknownLanguageRecordIds(): Promise<string[]> {
    return [
      ...new Set(
        await this.readLines(
          this.recordsPath(this.siteConfig.unknownLanguageBucket),
        ),
      ),
    ];
  }
  async migrateOutOfUnknownLanguageBucket(recordId: string): Promise<void> {
    const key = this.recordsPath(this.siteConfig.unknownLanguageBucket);
    await this.withFileLock(key, async () => {
      const existing = await this.readUnknownLanguageRecordIds();
      if (existing.includes(recordId)) {
        const remaining = existing.filter((id) => id !== recordId);
        await this.storage.write(
          key,
          remaining.map((id) => `${id}\n`).join(''),
        );
        this.logger.debug(`Removed ${recordId} from ${key}`);
      }
    });
    await this.storage.remove(
      this.recordDetailPath(this.siteConfig.unknownLanguageBucket, recordId),
    );
  }
  async appendFailure(runId: string, entry: FailureLogEntry): Promise<void> {
    const key = this.failuresLogPath(runId);
    await this.storage.append(
      key,
      `${JSON.stringify({ ...entry, timestamp: new Date().toISOString() })}\n`,
    );
    this.logger.debug(`Appended failure entry for ${entry.recordId} to ${key}`);
  }
  async listRecordDetailHtmlFiles(): Promise<string[]> {
    const keys = await this.storage.list(this.siteConfig.recordDetailRootDir);
    return keys.filter((key) => key.endsWith('.html'));
  }
  async resetRawRecordTitlesFile(): Promise<void> {
    const key = this.rawRecordTitlesPath();
    await this.storage.write(key, '');
    this.logger.debug(`Reset ${key}`);
  }
  async appendRawRecordTitle(title: string): Promise<void> {
    const key = this.rawRecordTitlesPath();
    await this.storage.append(key, `${title}\n`);
    this.logger.debug(`Appended record title to ${key}`);
  }
  async readRawRecordTitles(): Promise<string[]> {
    return this.readLines(this.rawRecordTitlesPath());
  }
  async writeDedupSortedRecordTitles(titles: string[]): Promise<void> {
    const key = this.dedupSortedRecordTitlesPath();
    await this.storage.write(key, titles.map((title) => `${title}\n`).join(''));
    this.logger.debug(`Wrote ${titles.length} title(s) to ${key}`);
  }
  async readDedupSortedRecordTitles(): Promise<string[]> {
    return this.readLines(this.dedupSortedRecordTitlesPath());
  }
  async writeFilteredRecordTitles(titles: string[]): Promise<void> {
    const key = this.filteredRecordTitlesPath();
    await this.storage.write(key, titles.map((title) => `${title}\n`).join(''));
    this.logger.debug(`Wrote ${titles.length} title(s) to ${key}`);
  }
  async readFilteredRecordTitles(): Promise<Set<string>> {
    return new Set(await this.readLines(this.filteredRecordTitlesPath()));
  }
  filteredRecordCopyPath(bucket: string, fileName: string): string {
    return join(this.siteConfig.recordsFilteredRootDir, bucket, fileName);
  }
  async copyRecordDetailToFiltered(
    sourceKey: string,
    bucket: string,
  ): Promise<string> {
    const destKey = this.filteredRecordCopyPath(bucket, basename(sourceKey));
    await this.storage.copy(sourceKey, destKey);
    this.logger.debug(`Copied ${sourceKey} to ${destKey}`);
    return destKey;
  }
}
