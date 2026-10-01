import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DeadLetterService,
  SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
  SCRAPE_LISTING_INIT_TOPIC,
  SCRAPE_LISTING_PAGE_TOPIC,
  type PendingReprocessMessage,
  type ListingInitMessage,
  type ListingPageMessage,
} from '@app/queue';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
@Controller()
export class ListingController {
  constructor(
    private readonly listingCrawler: ListingCrawlerService,
    private readonly pendingReprocess: PendingReprocessService,
    private readonly deadLetter: DeadLetterService,
  ) {}
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
}
