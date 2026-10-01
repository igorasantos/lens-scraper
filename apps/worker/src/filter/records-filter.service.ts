import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface RecordsFilterResult {
  filesScanned: number;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordsFilterService {
  private readonly logger = new Logger(RecordsFilterService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}
  async run(runId: string): Promise<RecordsFilterResult> {
    const fileKeys = await this.storage.listRecordDetailHtmlFiles();
    this.logger.log(
      `[${runId}] Found ${fileKeys.length} record detail html file(s); dispatching filter copy.`,
    );
    await this.queue.publishRecordFilterCopiesBatch(
      fileKeys.map((fileKey) => ({ runId, fileKey })),
    );
    return { filesScanned: fileKeys.length };
  }
}
