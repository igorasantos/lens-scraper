import { Module } from '@nestjs/common';
import { ListingModule } from './listing/listing.module.js';
import { DetailModule } from './detail/detail.module.js';
import { TitlesModule } from './titles/titles.module.js';
import { FilterModule } from './filter/filter.module.js';
import { DlqModule } from './dlq/dlq.module.js';
@Module({
  imports: [ListingModule, DetailModule, TitlesModule, FilterModule, DlqModule],
})
export class ApiModule {}
