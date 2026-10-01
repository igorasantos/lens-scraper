import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { QueueModule } from '@app/queue';
import { FilterController } from './filter.controller.js';
import { FilterService } from './filter.service.js';
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [FilterController],
  providers: [FilterService],
})
export class FilterModule {}
