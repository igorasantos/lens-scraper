import { Injectable, Logger } from '@nestjs/common';
import { SiteService } from '@app/site';
import type { RecordTitleExtractMessage } from '@app/queue';
import { StorageService } from '@app/storage';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordTitleExtractService {
  private readonly logger = new Logger(RecordTitleExtractService.name);
  constructor(
    private readonly site: SiteService,
    private readonly storage: StorageService,
  ) {}
  async run(message: RecordTitleExtractMessage): Promise<void> {
    const { runId, fileKey } = message;
    const html = await this.storage.read(fileKey);
    const title = this.site.extractRecordTitleFromHtml(html);
    if (!title) {
      this.logger.warn(`[${runId}] No title extracted from ${fileKey}`);
      return;
    }
    await this.storage.appendRawRecordTitle(title);
  }
}
