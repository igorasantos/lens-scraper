import { Injectable, Logger } from '@nestjs/common';
import { stampScheduledAt, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface XxReprocessResult {
  reprocessed: string[];
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class XxReprocessService {
  private readonly logger = new Logger(XxReprocessService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}
  async run(runId: string): Promise<XxReprocessResult> {
    const recordIds = await this.storage.readUnknownLanguageRecordIds();
    if (recordIds.length === 0) {
      this.logger.log(`[${runId}] No records_xx.txt record ids to reprocess.`);
      return { reprocessed: [] };
    }
    const scheduled = stampScheduledAt(recordIds);
    await this.queue.publishRecordDetailsBatch(
      scheduled.map((entry) => ({ ...entry, runId })),
    );
    this.logger.log(
      `[${runId}] Reprocessing ${scheduled.length} records_xx.txt record(s).`,
    );
    return { reprocessed: scheduled.map((entry) => entry.recordId) };
  }
}
