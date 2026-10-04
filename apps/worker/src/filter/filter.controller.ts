import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  SCRAPE_RECORD_FILTER_COPY_TOPIC,
  SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
  SCRAPE_RECORDS_FILTER_TOPIC,
  type RecordFilterCopyMessage,
  type RecordLanguageClassifyMessage,
  type RecordsFilterMessage,
} from '@app/queue';
import { HandlerRetryService, StorageService } from '@app/storage';
import { RecordsFilterService } from './records-filter.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
@Controller()
export class FilterController {
  constructor(
    private readonly recordsFilter: RecordsFilterService,
    private readonly recordFilterCopy: RecordFilterCopyService,
    private readonly recordLanguageClassify: RecordLanguageClassifyService,
    private readonly handlerRetry: HandlerRetryService,
    private readonly storage: StorageService,
  ) {}
  @EventPattern(SCRAPE_RECORDS_FILTER_TOPIC)
  handleRecordsFilter(
    @Payload()
    message: RecordsFilterMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_FILTER_TOPIC,
      { runId: message.runId },
      message,
      () => this.recordsFilter.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_FILTER_COPY_TOPIC)
  handleRecordFilterCopy(
    @Payload()
    message: RecordFilterCopyMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_FILTER_COPY_TOPIC,
      {
        runId: message.runId,
        recordId: this.storage.recordIdFromDetailKey(message.fileKey),
      },
      message,
      () => this.recordFilterCopy.run(message),
    );
  }
  @EventPattern(SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC)
  handleRecordLanguageClassify(
    @Payload()
    message: RecordLanguageClassifyMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
      { runId: message.runId, recordId: message.recordId },
      message,
      () => this.recordLanguageClassify.run(message),
    );
  }
}
