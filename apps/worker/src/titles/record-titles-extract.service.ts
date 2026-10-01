import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
export interface RecordTitlesExtractResult {
  filesScanned: number;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordTitlesExtractService {
  private readonly logger = new Logger(RecordTitlesExtractService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}
  async run(runId: string): Promise<RecordTitlesExtractResult> {
    const fileKeys = await this.storage.listRecordDetailHtmlFiles();
    this.logger.log(
      `[${runId}] Found ${fileKeys.length} record detail html file(s); dispatching title extraction.`,
    );
    await this.storage.resetRawRecordTitlesFile();
    await this.queue.publishRecordTitleExtractsBatch(
      fileKeys.map((fileKey) => ({ runId, fileKey })),
    );
    return { filesScanned: fileKeys.length };
  }
}
