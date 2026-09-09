import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@app/config';
import { REDIS_CLIENT } from './redis-client.token.js';
import { LOCK_PORT } from './lock-port.token.js';
import { RedisLockAdapter } from './adapters/redis-lock.adapter.js';
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.redisUrl, { lazyConnect: true }),
    },
    {
      provide: LOCK_PORT,
      inject: [REDIS_CLIENT, ConfigService],
      useFactory: (redis: Redis, config: ConfigService) => {
        if (config.lockProvider !== 'local') {
          throw new Error(
            `Unsupported LOCK_PROVIDER: ${config.lockProvider} (only 'local' is implemented)`,
          );
        }
        return new RedisLockAdapter(redis);
      },
    },
  ],
  exports: [LOCK_PORT],
})
export class RedisLockModule {}
