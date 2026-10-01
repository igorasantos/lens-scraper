import { Injectable, Logger } from '@nestjs/common';
import { stampScheduledAt, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface ExpiredReprocessResult {
  reprocessed: string[];
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class ExpiredReprocessService {
  private readonly logger = new Logger(ExpiredReprocessService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}
  async run(runId: string): Promise<ExpiredReprocessResult> {
    const recordIds = await this.storage.readExpiredRecordIds();
    if (recordIds.length === 0) {
      this.logger.log(`[${runId}] No expired record ids to reprocess.`);
      return { reprocessed: [] };
    }
    const scheduled = stampScheduledAt(recordIds);
    await this.queue.publishRecordDetailsBatch(
      scheduled.map((entry) => ({ ...entry, runId })),
    );
    this.logger.log(
      `[${runId}] Reprocessing ${scheduled.length} expired record(s).`,
    );
    return { reprocessed: scheduled.map((entry) => entry.recordId) };
  }
}
