import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '@app/storage';
export interface RecordTitlesDedupSortResult {
  titleCount: number;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordTitlesDedupSortService {
  private readonly logger = new Logger(RecordTitlesDedupSortService.name);
  constructor(private readonly storage: StorageService) {}
  async run(runId: string): Promise<RecordTitlesDedupSortResult> {
    const rawTitles = await this.storage.readRawRecordTitles();
    const titles = [...new Set(rawTitles)].sort((a, b) => a.localeCompare(b));
    await this.storage.writeDedupSortedRecordTitles(titles);
    this.logger.log(
      `[${runId}] Wrote ${titles.length} deduped title(s) from ${rawTitles.length} raw title(s).`,
    );
    return { titleCount: titles.length };
  }
}
