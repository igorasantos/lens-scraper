import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { QueueModule } from '@app/queue';
import { ListingController } from './listing.controller.js';
import { ListingService } from './listing.service.js';
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [ListingController],
  providers: [ListingService],
})
export class ListingModule {}
