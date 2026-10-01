import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { SiteModule } from '@app/site';
import { StorageModule } from '@app/storage';
import { QueueModule } from '@app/queue';
import { FilterController } from './filter.controller.js';
import { RecordsFilterService } from './records-filter.service.js';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
@Module({
  imports: [ConfigModule, SiteModule, StorageModule, QueueModule],
  controllers: [FilterController],
  providers: [
    RecordsFilterService,
    RecordFilterCopyService,
    RecordLanguageClassifyService,
  ],
})
export class FilterModule {}
