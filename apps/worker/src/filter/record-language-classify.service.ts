import { Injectable, Logger } from '@nestjs/common';
import { guessLanguageAlpha2, SiteService } from '@app/site';
import type { RecordLanguageClassifyMessage } from '@app/queue';
import { StorageService } from '@app/storage';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordLanguageClassifyService {
  private readonly logger = new Logger(RecordLanguageClassifyService.name);
  constructor(
    private readonly site: SiteService,
    private readonly storage: StorageService,
  ) {}
  async run(message: RecordLanguageClassifyMessage): Promise<void> {
    const { runId, recordId } = message;
    const key = this.storage.expiredRecordDetailPath(recordId);
    let html: string;
    try {
      html = await this.storage.read(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn(
          `[${runId}] No expired record detail found for ${recordId} at ${key}; skipping.`,
        );
        return;
      }
      throw error;
    }
    const bodyContentText = this.site.extractBodyContentTextFromHtml(
      html,
      recordId,
    );
    const languageAlpha2 = guessLanguageAlpha2(bodyContentText ?? '');
    await this.storage.moveExpiredRecordToLanguageBucket(
      recordId,
      languageAlpha2,
      html,
    );
    this.logger.log(
      `[${runId}] Classified ${recordId} as '${languageAlpha2}' and moved it out of the expired bucket.`,
    );
  }
}
