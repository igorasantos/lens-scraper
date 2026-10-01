import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { QueueModule } from '@app/queue';
import { TitlesController } from './titles.controller.js';
import { TitlesService } from './titles.service.js';
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [TitlesController],
  providers: [TitlesService],
})
export class TitlesModule {}
