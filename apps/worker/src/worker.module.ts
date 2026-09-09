import { Module } from '@nestjs/common';
import { BrowserModule } from '@app/browser';
import { ConfigModule } from '@app/config';
import { SiteModule } from '@app/site';
import { StorageModule } from '@app/storage';
import { QueueModule } from '@app/queue';
import { RedisLockModule } from '@app/redis-lock';
import { WorkerController } from './worker.controller.js';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { ListingDispatchService } from './listing-dispatch.service.js';
import { ListingContinueService } from './listing-continue.service.js';
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
@Module({
  imports: [
    ConfigModule,
    BrowserModule,
    SiteModule,
    StorageModule,
    QueueModule,
    RedisLockModule,
  ],
  controllers: [WorkerController],
  providers: [
    ListingCrawlerService,
    ListingDispatchService,
    ListingContinueService,
    DetailScraperService,
    ExpiredReprocessService,
    XxReprocessService,
    RecordTitlesExtractService,
    RecordTitleExtractService,
    RecordTitlesDedupSortService,
    RecordTitlesFilterService,
    RecordsFilterService,
    RecordFilterCopyService,
    RecordLanguageClassifyService,
  ],
})
export class WorkerModule {}
