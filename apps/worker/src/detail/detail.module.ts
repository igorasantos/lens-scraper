import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { BrowserModule } from '@app/browser';
import { SiteModule } from '@app/site';
import { StorageModule } from '@app/storage';
import { QueueModule } from '@app/queue';
import { RedisLockModule } from '@app/redis-lock';
import { DetailController } from './detail.controller.js';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
@Module({
  imports: [
    ConfigModule,
    BrowserModule,
    SiteModule,
    StorageModule,
    QueueModule,
    RedisLockModule,
  ],
  controllers: [DetailController],
  providers: [
    DetailScraperService,
    ExpiredReprocessService,
    XxReprocessService,
  ],
})
export class DetailModule {}
