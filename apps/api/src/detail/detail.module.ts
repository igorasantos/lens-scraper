import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { QueueModule } from '@app/queue';
import { DetailController } from './detail.controller.js';
import { DetailService } from './detail.service.js';
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [DetailController],
  providers: [DetailService],
})
export class DetailModule {}
