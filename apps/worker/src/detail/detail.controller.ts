import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DeadLetterService,
  SCRAPE_RECORD_DETAIL_TOPIC,
  SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
  SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
  type ExpiredReprocessMessage,
  type RecordDetailMessage,
  type XxReprocessMessage,
} from '@app/queue';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
@Controller()
export class DetailController {
  constructor(
    private readonly detailScraper: DetailScraperService,
    private readonly expiredReprocess: ExpiredReprocessService,
    private readonly xxReprocess: XxReprocessService,
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
}
