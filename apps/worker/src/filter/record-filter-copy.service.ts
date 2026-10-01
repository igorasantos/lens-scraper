import { Injectable, Logger } from '@nestjs/common';
import { basename, dirname } from 'node:path';
import { SiteService } from '@app/site';
import type { RecordFilterCopyMessage } from '@app/queue';
import { StorageService } from '@app/storage';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordFilterCopyService {
  private readonly logger = new Logger(RecordFilterCopyService.name);
  constructor(
    private readonly site: SiteService,
    private readonly storage: StorageService,
  ) {}
  async run(message: RecordFilterCopyMessage): Promise<void> {
    const { runId, fileKey } = message;
    const html = await this.storage.read(fileKey);
    const title = this.site.extractRecordTitleFromHtml(html);
    if (!title) {
      this.logger.warn(`[${runId}] No title extracted from ${fileKey}`);
      return;
    }
    const filteredTitles = await this.storage.readFilteredRecordTitles();
    if (!filteredTitles.has(title)) {
      return;
    }
    const bucket = basename(dirname(fileKey));
    const destKey = await this.storage.copyRecordDetailToFiltered(
      fileKey,
      bucket,
    );
    this.logger.log(`[${runId}] Copied ${fileKey} to ${destKey}`);
  }
}
