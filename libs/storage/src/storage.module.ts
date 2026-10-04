import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@app/config';
import { SiteModule } from '@app/site';
import { RedisLockModule } from '@app/redis-lock';
import { StorageService } from './storage.service.js';
import { DeadLetterService } from './dead-letter.service.js';
import { STORAGE_PORT } from './storage-port.token.js';
import { LocalFilesystemStorageAdapter } from './adapters/local-filesystem-storage.adapter.js';
@Module({
  imports: [ConfigModule, SiteModule, RedisLockModule],
  providers: [
    StorageService,
    DeadLetterService,
    {
      provide: STORAGE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.storageProvider !== 'local') {
          throw new Error(
            `Unsupported STORAGE_PROVIDER: ${config.storageProvider} (only 'local' is implemented)`,
          );
        }
        return new LocalFilesystemStorageAdapter(config);
      },
    },
  ],
  exports: [StorageService, DeadLetterService, STORAGE_PORT],
})
export class StorageModule {}
