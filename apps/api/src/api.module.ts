import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { QueueModule } from '@app/queue';
import { ScrapeController } from './scrape.controller.js';
import { ScrapeService } from './scrape.service.js';
import { DlqController } from './dlq.controller.js';
import { DlqService } from './dlq.service.js';
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [ScrapeController, DlqController],
  providers: [ScrapeService, DlqService],
})
export class ApiModule {}
