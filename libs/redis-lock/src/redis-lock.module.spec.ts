import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { RedisLockModule } from './redis-lock.module.js';
import { REDIS_CLIENT } from './redis-client.token.js';
import { LOCK_PORT } from './lock-port.token.js';
import { RedisLockAdapter } from './adapters/redis-lock.adapter.js';
describe('RedisLockModule', () => {
  function fakeConfig(overrides: Partial<ConfigService> = {}): ConfigService {
    return {
      redisUrl: 'redis://localhost:6379',
      lockProvider: 'local',
      ...overrides,
    } as unknown as ConfigService;
  }
  it('wires LOCK_PORT to a RedisLockAdapter over a lazily-connecting ioredis client built from REDIS_URL', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RedisLockModule],
    })
      .overrideProvider(ConfigService)
      .useValue(fakeConfig())
      .compile();
    expect(module.get(LOCK_PORT)).toBeInstanceOf(RedisLockAdapter);
    const client = module.get(REDIS_CLIENT) as {
      options: { lazyConnect: boolean };
    };
    expect(client.options.lazyConnect).toBe(true);
    await module.close();
  });
  it('rejects compilation when LOCK_PROVIDER is not local', async () => {
    await expect(
      Test.createTestingModule({ imports: [RedisLockModule] })
        .overrideProvider(ConfigService)
        .useValue(fakeConfig({ lockProvider: 'aws' }))
        .compile(),
    ).rejects.toThrow(/Unsupported LOCK_PROVIDER: aws/);
  });
});
