import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { DlqController } from './dlq.controller.js';
import { DlqService } from './dlq.service.js';
@Module({
  imports: [ConfigModule],
  controllers: [DlqController],
  providers: [DlqService],
})
export class DlqModule {}
