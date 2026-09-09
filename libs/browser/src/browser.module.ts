import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { BrowserService } from './browser.service.js';
@Module({
  imports: [ConfigModule],
  providers: [BrowserService],
  exports: [BrowserService],
})
export class BrowserModule {}
