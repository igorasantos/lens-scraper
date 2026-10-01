import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '@app/storage';
export interface RecordTitlesFilterResult {
  titleCount: number;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class RecordTitlesFilterService {
  private readonly logger = new Logger(RecordTitlesFilterService.name);
  constructor(private readonly storage: StorageService) {}
  async run(
    runId: string,
    substrings: string[],
  ): Promise<RecordTitlesFilterResult> {
    const needles = substrings.map((substring) => substring.toLowerCase());
    const titles = await this.storage.readDedupSortedRecordTitles();
    const filtered = titles.filter(
      (title) =>
        !needles.some((needle) => title.toLowerCase().includes(needle)),
    );
    await this.storage.writeFilteredRecordTitles(filtered);
    this.logger.log(
      `[${runId}] Kept ${filtered.length} of ${titles.length} title(s) after filtering out ${substrings.length} substring(s).`,
    );
    return { titleCount: filtered.length };
  }
}
