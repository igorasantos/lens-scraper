import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { BrowserModule } from '@app/browser';
import { SiteModule } from '@app/site';
import { StorageModule } from '@app/storage';
import { QueueModule } from '@app/queue';
import { RedisLockModule } from '@app/redis-lock';
import { ListingController } from './listing.controller.js';
import { ListingCrawlerService } from './listing-crawler.service.js';
import { ListingDispatchService } from './listing-dispatch.service.js';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { RecordsRecycleService } from './records-recycle.service.js';
@Module({
  imports: [
    ConfigModule,
    BrowserModule,
    SiteModule,
    StorageModule,
    QueueModule,
    RedisLockModule,
  ],
  controllers: [ListingController],
  providers: [
    ListingCrawlerService,
    ListingDispatchService,
    PendingReprocessService,
    RecordsRecycleService,
  ],
})
export class ListingModule {}
