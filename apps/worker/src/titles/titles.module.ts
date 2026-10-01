import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { SiteModule } from '@app/site';
import { StorageModule } from '@app/storage';
import { QueueModule } from '@app/queue';
import { TitlesController } from './titles.controller.js';
import { RecordTitlesExtractService } from './record-titles-extract.service.js';
import { RecordTitleExtractService } from './record-title-extract.service.js';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
@Module({
  imports: [ConfigModule, SiteModule, StorageModule, QueueModule],
  controllers: [TitlesController],
  providers: [
    RecordTitlesExtractService,
    RecordTitleExtractService,
    RecordTitlesDedupSortService,
    RecordTitlesFilterService,
  ],
})
export class TitlesModule {}
