import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
  SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
  SCRAPE_RECORD_TITLES_FILTER_TOPIC,
  SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
  type RecordTitleExtractMessage,
  type RecordTitlesDedupSortMessage,
  type RecordTitlesExtractMessage,
  type RecordTitlesFilterMessage,
} from '@app/queue';
import { HandlerRetryService, StorageService } from '@app/storage';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
@Controller()
export class TitlesController {
  constructor(
    private readonly recordTitlesExtract: RecordTitlesExtractService,
    private readonly recordTitleExtract: RecordTitleExtractService,
    private readonly recordTitlesDedupSort: RecordTitlesDedupSortService,
    private readonly recordTitlesFilter: RecordTitlesFilterService,
    private readonly handlerRetry: HandlerRetryService,
    private readonly storage: StorageService,
  ) {}
  @EventPattern(SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC)
  handleRecordTitlesExtract(
    @Payload()
    message: RecordTitlesExtractMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
      { runId: message.runId },
      message,
      () => this.recordTitlesExtract.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLE_EXTRACT_TOPIC)
  handleRecordTitleExtract(
    @Payload()
    message: RecordTitleExtractMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
      {
        runId: message.runId,
        recordId: this.storage.recordIdFromDetailKey(message.fileKey),
      },
      message,
      () => this.recordTitleExtract.run(message),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC)
  handleRecordTitlesDedupSort(
    @Payload()
    message: RecordTitlesDedupSortMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
      { runId: message.runId },
      message,
      () => this.recordTitlesDedupSort.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLES_FILTER_TOPIC)
  handleRecordTitlesFilter(
    @Payload()
    message: RecordTitlesFilterMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_TITLES_FILTER_TOPIC,
      { runId: message.runId },
      message,
      () => this.recordTitlesFilter.run(message.runId, message.substrings),
    );
  }
}
