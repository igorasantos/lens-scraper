import { Inject, Injectable, Logger } from '@nestjs/common';
import { QUEUE_PORT } from './queue-port.token.js';
import type { QueuePort } from './queue.port.js';
import type {
  ExpiredReprocessMessage,
  RecordDetailMessage,
  RecordFilterCopyMessage,
  RecordLanguageClassifyMessage,
  RecordsFilterMessage,
  RecordTitleExtractMessage,
  RecordTitlesDedupSortMessage,
  RecordTitlesExtractMessage,
  RecordTitlesFilterMessage,
  PendingReprocessMessage,
  ListingInitMessage,
  ListingPageMessage,
  XxReprocessMessage,
} from './messages.js';
import {
  SCRAPE_RECORD_DETAIL_TOPIC,
  SCRAPE_RECORD_FILTER_COPY_TOPIC,
  SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
  SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
  SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
  SCRAPE_RECORD_TITLES_FILTER_TOPIC,
  SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
  SCRAPE_RECORDS_FILTER_TOPIC,
  SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
  SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
  SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
  SCRAPE_LISTING_INIT_TOPIC,
  SCRAPE_LISTING_PAGE_TOPIC,
} from './topics.js';
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  constructor(
    @Inject(QUEUE_PORT)
    private readonly queuePort: QueuePort,
  ) {}
  publishListingInit(message: ListingInitMessage): Promise<void> {
    return this.emit(SCRAPE_LISTING_INIT_TOPIC, message);
  }
  publishPendingReprocess(message: PendingReprocessMessage): Promise<void> {
    return this.emit(SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC, message);
  }
  publishListingPage(message: ListingPageMessage): Promise<void> {
    return this.emit(SCRAPE_LISTING_PAGE_TOPIC, message);
  }
  publishRecordDetailsBatch(messages: RecordDetailMessage[]): Promise<void> {
    return this.publishBatch(SCRAPE_RECORD_DETAIL_TOPIC, messages);
  }
  publishExpiredReprocess(message: ExpiredReprocessMessage): Promise<void> {
    return this.emit(SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC, message);
  }
  publishXxReprocess(message: XxReprocessMessage): Promise<void> {
    return this.emit(SCRAPE_RECORDS_XX_REPROCESS_TOPIC, message);
  }
  publishRecordTitlesExtract(
    message: RecordTitlesExtractMessage,
  ): Promise<void> {
    return this.emit(SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC, message);
  }
  publishRecordTitleExtract(message: RecordTitleExtractMessage): Promise<void> {
    return this.emit(SCRAPE_RECORD_TITLE_EXTRACT_TOPIC, message);
  }
  publishRecordTitleExtractsBatch(
    messages: RecordTitleExtractMessage[],
  ): Promise<void> {
    return this.publishBatch(SCRAPE_RECORD_TITLE_EXTRACT_TOPIC, messages);
  }
  publishRecordTitlesDedupSort(
    message: RecordTitlesDedupSortMessage,
  ): Promise<void> {
    return this.emit(SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC, message);
  }
  publishRecordTitlesFilter(message: RecordTitlesFilterMessage): Promise<void> {
    return this.emit(SCRAPE_RECORD_TITLES_FILTER_TOPIC, message);
  }
  publishRecordsFilter(message: RecordsFilterMessage): Promise<void> {
    return this.emit(SCRAPE_RECORDS_FILTER_TOPIC, message);
  }
  publishRecordFilterCopy(message: RecordFilterCopyMessage): Promise<void> {
    return this.emit(SCRAPE_RECORD_FILTER_COPY_TOPIC, message);
  }
  publishRecordFilterCopiesBatch(
    messages: RecordFilterCopyMessage[],
  ): Promise<void> {
    return this.publishBatch(SCRAPE_RECORD_FILTER_COPY_TOPIC, messages);
  }
  publishRecordLanguageClassifyBatch(
    messages: RecordLanguageClassifyMessage[],
  ): Promise<void> {
    return this.publishBatch(SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC, messages);
  }
  private async publishBatch<T>(topic: string, messages: T[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }
    await Promise.all(messages.map((message) => this.emit(topic, message)));
    this.logger.log(`Published ${messages.length} message(s) to ${topic}`);
  }
  private async emit<T>(topic: string, payload: T): Promise<void> {
    await this.queuePort.publish(topic, payload);
  }
}
