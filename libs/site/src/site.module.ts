import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/config';
import { SiteConfigService } from './site-config.service.js';
import { SiteService } from './site.service.js';
@Module({
  imports: [ConfigModule],
  providers: [SiteConfigService, SiteService],
  exports: [SiteConfigService, SiteService],
})
export class SiteModule {}
