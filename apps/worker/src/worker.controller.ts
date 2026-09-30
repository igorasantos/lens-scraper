import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DeadLetterService,
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
  type ExpiredReprocessMessage,
  type RecordDetailMessage,
  type RecordFilterCopyMessage,
  type RecordLanguageClassifyMessage,
  type RecordsFilterMessage,
  type RecordTitleExtractMessage,
  type RecordTitlesDedupSortMessage,
  type RecordTitlesExtractMessage,
  type RecordTitlesFilterMessage,
  type PendingReprocessMessage,
  type ListingInitMessage,
  type ListingPageMessage,
  type XxReprocessMessage,
} from '@app/queue';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
import { RecordsFilterService } from './records-filter.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { ListingCrawlerService } from './listing-crawler.service.js';
@Controller()
export class WorkerController {
  constructor(
    private readonly detailScraper: DetailScraperService,
    private readonly listingCrawler: ListingCrawlerService,
    private readonly pendingReprocess: PendingReprocessService,
    private readonly expiredReprocess: ExpiredReprocessService,
    private readonly xxReprocess: XxReprocessService,
    private readonly recordTitlesExtract: RecordTitlesExtractService,
    private readonly recordTitleExtract: RecordTitleExtractService,
    private readonly recordTitlesDedupSort: RecordTitlesDedupSortService,
    private readonly recordTitlesFilter: RecordTitlesFilterService,
    private readonly recordsFilter: RecordsFilterService,
    private readonly recordFilterCopy: RecordFilterCopyService,
    private readonly recordLanguageClassify: RecordLanguageClassifyService,
    private readonly deadLetter: DeadLetterService,
  ) {}
  @EventPattern(SCRAPE_RECORD_DETAIL_TOPIC)
  handleRecordDetail(
    @Payload()
    message: RecordDetailMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORD_DETAIL_TOPIC, message, () =>
      this.detailScraper.handle(message),
    );
  }
  @EventPattern(SCRAPE_LISTING_INIT_TOPIC)
  handleListingInit(
    @Payload()
    message: ListingInitMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_LISTING_INIT_TOPIC, message, () =>
      this.listingCrawler.start(
        message.runId,
        message.baseUrl,
        message.startPage,
      ),
    );
  }
  @EventPattern(SCRAPE_LISTING_PAGE_TOPIC)
  handleListingPage(
    @Payload()
    message: ListingPageMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_LISTING_PAGE_TOPIC, message, () =>
      this.listingCrawler.continuePage(message),
    );
  }
  @EventPattern(SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC)
  handlePendingReprocess(
    @Payload()
    message: PendingReprocessMessage,
  ): Promise<void> {
    return this.deadLetter.run(
      SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
      message,
      () => this.pendingReprocess.run(message.runId, message.fromRunId),
    );
  }
  @EventPattern(SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC)
  handleExpiredReprocess(
    @Payload()
    message: ExpiredReprocessMessage,
  ): Promise<void> {
    return this.deadLetter.run(
      SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
      message,
      () => this.expiredReprocess.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORDS_XX_REPROCESS_TOPIC)
  handleXxReprocess(
    @Payload()
    message: XxReprocessMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORDS_XX_REPROCESS_TOPIC, message, () =>
      this.xxReprocess.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC)
  handleRecordTitlesExtract(
    @Payload()
    message: RecordTitlesExtractMessage,
  ): Promise<void> {
    return this.deadLetter.run(
      SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
      message,
      () => this.recordTitlesExtract.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLE_EXTRACT_TOPIC)
  handleRecordTitleExtract(
    @Payload()
    message: RecordTitleExtractMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORD_TITLE_EXTRACT_TOPIC, message, () =>
      this.recordTitleExtract.run(message),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC)
  handleRecordTitlesDedupSort(
    @Payload()
    message: RecordTitlesDedupSortMessage,
  ): Promise<void> {
    return this.deadLetter.run(
      SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
      message,
      () => this.recordTitlesDedupSort.run(message.runId),
    );
  }
  @EventPattern(SCRAPE_RECORD_TITLES_FILTER_TOPIC)
  handleRecordTitlesFilter(
    @Payload()
    message: RecordTitlesFilterMessage,
  ): Promise<void> {
    return this.deadLetter.run(SCRAPE_RECORD_TITLES_FILTER_TOPIC, message, () =>
      this.recordTitlesFilter.run(message.runId, message.substrings),
    );
  }
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
