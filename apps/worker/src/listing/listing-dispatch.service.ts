import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { stampScheduledAt, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface ListingDispatchResult {
  dispatched: string[];
  skipped: string[];
  reclassified: string[];
  deferred: string[];
}
@Injectable()
export class ListingDispatchService {
  private readonly logger = new Logger(ListingDispatchService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}
  async dispatch(
    runId: string,
    recordIds: string[],
  ): Promise<ListingDispatchResult> {
    const existing = await this.storage.readRecordIds();
    const uniqueRecordIds = [...new Set(recordIds)];
    const toDispatch = uniqueRecordIds.filter((id) => !existing.has(id));
    const skipped = uniqueRecordIds.filter((id) => existing.has(id));
    await this.storage.writeListingIds(runId, toDispatch);
    if (toDispatch.length === 0) {
      this.logger.log(
        `[${runId}] No new record ids to dispatch after dedupe (${skipped.length} already scraped).`,
      );
      return { dispatched: [], skipped, reclassified: [], deferred: [] };
    }
    const expiredFlags = await Promise.all(
      toDispatch.map((id) => this.storage.hasExpiredRecordDetail(id)),
    );
    const toClassify = toDispatch.filter((_id, i) => expiredFlags[i]);
    const eligibleToScrape = toDispatch.filter((_id, i) => !expiredFlags[i]);
    const toScrape = eligibleToScrape.slice(
      0,
      this.config.maxRecordExtractions,
    );
    const deferred = eligibleToScrape.slice(this.config.maxRecordExtractions);
    if (toClassify.length > 0) {
      await this.queue.publishRecordLanguageClassifyBatch(
        toClassify.map((recordId) => ({ runId, recordId })),
      );
    }
    let dispatched: string[] = [];
    if (toScrape.length > 0) {
      const scheduled = stampScheduledAt(toScrape);
      await this.queue.publishRecordDetailsBatch(
        scheduled.map((entry) => ({ ...entry, runId })),
      );
      dispatched = scheduled.map((entry) => entry.recordId);
    }
    this.logger.log(
      `[${runId}] Dispatched ${dispatched.length} record(s), routed ${toClassify.length} previously-expired record(s) to language classification, deferred ${deferred.length} record(s) past MAX_RECORD_EXTRACTIONS=${this.config.maxRecordExtractions}, skipped ${skipped.length} already-scraped record(s).`,
    );
    return { dispatched, skipped, reclassified: toClassify, deferred };
  }
}
