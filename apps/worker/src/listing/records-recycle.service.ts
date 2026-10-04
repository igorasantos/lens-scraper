import { Injectable, Logger } from '@nestjs/common';
import { SiteConfigService } from '@app/site';
import { StorageService, type RecordDetailCatalogEntry } from '@app/storage';
import {
  ListingDispatchService,
  type ScrapeDispatchResult,
} from './listing-dispatch.service.js';
export interface RecordsRecycleResult extends ScrapeDispatchResult {
  recycled: string[];
  toScrape: string[];
}
@Injectable()
export class RecordsRecycleService {
  private readonly logger = new Logger(RecordsRecycleService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly siteConfig: SiteConfigService,
    private readonly dispatch: ListingDispatchService,
  ) {}
  async run(runId: string): Promise<RecordsRecycleResult> {
    const recordIds = await this.storage.readListingIds(runId);
    const catalog = await this.storage.readRecordDetailCatalog();
    const alreadyRecycled = new Set(
      await this.storage.readRecycledListingIds(runId),
    );
    const recycled: string[] = [];
    const recycledExpired: string[] = [];
    const toScrape: string[] = [];
    for (const recordId of recordIds) {
      const entry = catalog.get(recordId);
      if (!entry) {
        (alreadyRecycled.has(recordId) ? recycled : toScrape).push(recordId);
        continue;
      }
      await this.recycle(runId, recordId, entry, alreadyRecycled);
      recycled.push(recordId);
      if (entry.bucket === this.siteConfig.expiredRecordDetailDir) {
        recycledExpired.push(recordId);
      }
    }
    await this.storage.writeToScrapeListingIds(runId, toScrape);
    this.logger.log(
      `[${runId}] Recycled ${recycled.length} record(s) from the detail catalog (${recycledExpired.length} expired); ${toScrape.length} record(s) left to scrape.`,
    );
    const result = await this.dispatch.dispatchToScrape(runId, [
      ...toScrape,
      ...recycledExpired,
    ]);
    return { ...result, recycled, toScrape };
  }
  private async recycle(
    runId: string,
    recordId: string,
    entry: RecordDetailCatalogEntry,
    alreadyRecycled: Set<string>,
  ): Promise<void> {
    if (entry.bucket !== this.siteConfig.expiredRecordDetailDir) {
      await this.storage.appendRecordId(recordId, entry.bucket);
    }
    if (!alreadyRecycled.has(recordId)) {
      await this.storage.appendRecycledListingId(runId, recordId);
    }
    await this.storage.recycleRecordDetail(recordId, entry);
  }
}
