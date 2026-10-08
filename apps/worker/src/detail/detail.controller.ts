import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  SCRAPE_RECORD_DETAIL_TOPIC,
  SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
  SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
  type ExpiredReprocessMessage,
  type RecordDetailMessage,
  type XxReprocessMessage,
} from '@app/queue';
import { HandlerRetryService } from '@app/storage';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
import { MANUAL_RUN_ID } from '../common/run-id.js';
@Controller()
export class DetailController {
  constructor(
    private readonly detailScraper: DetailScraperService,
    private readonly expiredReprocess: ExpiredReprocessService,
    private readonly xxReprocess: XxReprocessService,
    private readonly handlerRetry: HandlerRetryService,
  ) {}
  @EventPattern(SCRAPE_RECORD_DETAIL_TOPIC)
  handleRecordDetail(
    @Payload()
    message: RecordDetailMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORD_DETAIL_TOPIC,
      { runId: message.runId ?? MANUAL_RUN_ID, recordId: message.recordId },
      message,
      () => this.detailScraper.handle(message),
    );
  }
  @EventPattern(SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC)
  handleExpiredReprocess(
    @Payload()
    message: ExpiredReprocessMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
      { runId: message.runId },
      message,
      () => this.expiredReprocess.run(message.runId, message.detailMode),
    );
  }
  @EventPattern(SCRAPE_RECORDS_XX_REPROCESS_TOPIC)
  handleXxReprocess(
    @Payload()
    message: XxReprocessMessage,
  ): Promise<void> {
    return this.handlerRetry.runOrDeadLetter(
      SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
      { runId: message.runId },
      message,
      () => this.xxReprocess.run(message.runId, message.detailMode),
    );
  }
}
