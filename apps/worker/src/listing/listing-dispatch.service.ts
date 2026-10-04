import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { stampScheduledAt, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface ScrapeDispatchResult {
  dispatched: string[];
  reclassified: string[];
  deferred: string[];
}
export interface ListingDispatchResult extends ScrapeDispatchResult {
  skipped: string[];
}
export interface ListingDispatchOptions {
  recycle?: boolean;
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
    { recycle = false }: ListingDispatchOptions = {},
  ): Promise<ListingDispatchResult> {
    const existing = await this.storage.readRecordIds();
    const uniqueRecordIds = [...new Set(recordIds)];
    const toDispatch = uniqueRecordIds.filter((id) => !existing.has(id));
    const skipped = uniqueRecordIds.filter((id) => existing.has(id));
    await this.storage.writeListingIds(runId, toDispatch);
    const duplicates = recordIds.length - uniqueRecordIds.length;
    const countMessage = `${recordIds.length} record id(s) received - ${duplicates} duplicate(s) = ${uniqueRecordIds.length} unique - ${skipped.length} already in the scraped records control files`;
    if (toDispatch.length === 0) {
      this.logger.log(
        `[${runId}] ${countMessage} = 0 new record(s); nothing to dispatch.`,
      );
      return { dispatched: [], skipped, reclassified: [], deferred: [] };
    }
    if (recycle) {
      await this.queue.publishRecordsRecycle({ runId });
      this.logger.log(
        `[${runId}] ${countMessage} = ${toDispatch.length} record(s) handed to recycling before scraping.`,
      );
      return { dispatched: [], skipped, reclassified: [], deferred: [] };
    }
    this.logger.log(
      `[${runId}] ${countMessage} = ${toDispatch.length} record(s) left to dispatch.`,
    );
    const result = await this.dispatchToScrape(runId, toDispatch);
    return { ...result, skipped };
  }
  async dispatchToScrape(
    runId: string,
    recordIds: string[],
  ): Promise<ScrapeDispatchResult> {
    const expiredFlags = await Promise.all(
      recordIds.map((id) => this.storage.hasExpiredRecordDetail(id)),
    );
    const toClassify = recordIds.filter((_id, i) => expiredFlags[i]);
    const eligibleToScrape = recordIds.filter((_id, i) => !expiredFlags[i]);
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
      `[${runId}] Dispatched ${dispatched.length} record(s), routed ${toClassify.length} previously-expired record(s) to language classification, deferred ${deferred.length} record(s) past MAX_RECORD_EXTRACTIONS=${this.config.maxRecordExtractions}.`,
    );
    return { dispatched, reclassified: toClassify, deferred };
  }
}
