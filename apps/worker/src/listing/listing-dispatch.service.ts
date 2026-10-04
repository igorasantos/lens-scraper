import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { stampScheduledAt, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface ScrapeDispatchResult {
  dispatched: string[];
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
    const notInControlFiles = uniqueRecordIds.filter((id) => !existing.has(id));
    const expiredFlags = await Promise.all(
      notInControlFiles.map((id) => this.storage.hasExpiredRecordDetail(id)),
    );
    const toDispatch = notInControlFiles.filter((_id, i) => !expiredFlags[i]);
    const dispatchable = new Set(toDispatch);
    const skipped = uniqueRecordIds.filter((id) => !dispatchable.has(id));
    await this.storage.writeListingIds(runId, toDispatch);
    const duplicates = recordIds.length - uniqueRecordIds.length;
    const alreadyScraped = uniqueRecordIds.length - notInControlFiles.length;
    const expired = notInControlFiles.length - toDispatch.length;
    const countMessage = `${recordIds.length} record id(s) received - ${duplicates} duplicate(s) = ${uniqueRecordIds.length} unique - ${alreadyScraped} already in the scraped records control files - ${expired} already in the scraped expired dir`;
    if (toDispatch.length === 0) {
      this.logger.log(
        `[${runId}] ${countMessage} = 0 new record(s); nothing to dispatch.`,
      );
      return { dispatched: [], skipped, deferred: [] };
    }
    if (recycle) {
      await this.queue.publishRecordsRecycle({ runId });
      this.logger.log(
        `[${runId}] ${countMessage} = ${toDispatch.length} record(s) handed to recycling before scraping.`,
      );
      return { dispatched: [], skipped, deferred: [] };
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
    const toScrape = recordIds.slice(0, this.config.maxRecordExtractions);
    const deferred = recordIds.slice(this.config.maxRecordExtractions);
    let dispatched: string[] = [];
    if (toScrape.length > 0) {
      const scheduled = stampScheduledAt(toScrape);
      await this.queue.publishRecordDetailsBatch(
        scheduled.map((entry) => ({ ...entry, runId })),
      );
      dispatched = scheduled.map((entry) => entry.recordId);
    }
    this.logger.log(
      `[${runId}] Dispatched ${dispatched.length} record(s), deferred ${deferred.length} record(s) past MAX_RECORD_EXTRACTIONS=${this.config.maxRecordExtractions}.`,
    );
    return { dispatched, deferred };
  }
}
