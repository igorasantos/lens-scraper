import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DeadLetterService,
  SCRAPE_RECORD_FILTER_COPY_TOPIC,
  SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
  SCRAPE_RECORDS_FILTER_TOPIC,
  type RecordFilterCopyMessage,
  type RecordLanguageClassifyMessage,
  type RecordsFilterMessage,
} from '@app/queue';
import { RecordsFilterService } from './records-filter.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
@Controller()
export class FilterController {
  constructor(
    private readonly recordsFilter: RecordsFilterService,
    private readonly recordFilterCopy: RecordFilterCopyService,
    private readonly recordLanguageClassify: RecordLanguageClassifyService,
    private readonly deadLetter: DeadLetterService,
  ) {}
  @EventPattern(SCRAPE_RECORDS_FILTER_TOPIC)
  handleRecordsFilter(
    @Payload()
    message: RecordsFilterMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORDS_FILTER_TOPIC, message, () =>
      this.recordsFilter.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_FILTER_COPY_TOPIC)
  handleRecordFilterCopy(
    @Payload()
    message: RecordFilterCopyMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORD_FILTER_COPY_TOPIC, message, () =>
      this.recordFilterCopy.run(message),
    );
  }
  @EventPattern(SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC)
  handleRecordLanguageClassify(
    @Payload()
    message: RecordLanguageClassifyMessage,
  ): Promise<void> {
    return this.deadLetter.run(
      SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
      message,
      () => this.recordLanguageClassify.run(message),
    );
  }
}
