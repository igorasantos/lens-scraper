import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
  SCRAPE_RECORDS_RECYCLE_TOPIC,
  SCRAPE_LISTING_INIT_TOPIC,
  SCRAPE_LISTING_PAGE_TOPIC,
  type PendingReprocessMessage,
  type ListingInitMessage,
  type ListingPageMessage,
  type RecordsRecycleMessage,
} from '@app/queue';
import { HandlerRetryService } from '@app/storage';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { RecordsRecycleService } from './records-recycle.service.js';
@Controller()
export class ListingController {
  constructor(
    private readonly listingCrawler: ListingCrawlerService,
    private readonly pendingReprocess: PendingReprocessService,
    private readonly recordsRecycle: RecordsRecycleService,
    private readonly handlerRetry: HandlerRetryService,
  ) {}
  @EventPattern(SCRAPE_LISTING_INIT_TOPIC)
  handleListingInit(
    @Payload()
    message: ListingInitMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_LISTING_INIT_TOPIC,
      { runId: message.runId },
      message,
      () => this.listingCrawler.start(message),
    );
  }
  @EventPattern(SCRAPE_LISTING_PAGE_TOPIC)
  handleListingPage(
    @Payload()
    message: ListingPageMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_LISTING_PAGE_TOPIC,
      { runId: message.runId },
      message,
      () => this.listingCrawler.continuePage(message),
    );
  }
  @EventPattern(SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC)
  handlePendingReprocess(
    @Payload()
    message: PendingReprocessMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
      { runId: message.runId },
      message,
      () =>
        this.pendingReprocess.run(message.runId, message.fromRunId, {
          detailMode: message.detailMode,
          recycle: message.recycle,
          dispatchCount: message.dispatchCount,
        }),
    );
  }
  @EventPattern(SCRAPE_RECORDS_RECYCLE_TOPIC)
  handleRecordsRecycle(
    @Payload()
    message: RecordsRecycleMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_RECYCLE_TOPIC,
      { runId: message.runId },
      message,
      () =>
        this.recordsRecycle.run(message.runId, {
          detailMode: message.detailMode,
          dispatchCount: message.dispatchCount,
        }),
    );
  }
}
