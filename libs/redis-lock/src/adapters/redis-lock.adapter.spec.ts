import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from '../redis-client.token.js';
import { RedisLockAdapter } from './redis-lock.adapter.js';
class FakeRedis {
  private readonly store = new Map<string, string>();
  quit = vi.fn().mockResolvedValue('OK');
  async set(
    key: string,
    value: string,
    _mode: 'PX',
    _ttlMs: number,
    flag: 'NX',
  ): Promise<'OK' | null> {
    if (flag === 'NX' && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    return 'OK';
  }
  async eval(
    _script: string,
    _numkeys: number,
    key: string,
    token: string,
    ttlMs?: number,
  ): Promise<number> {
    if (this.store.get(key) !== token) {
      return 0;
    }
    if (ttlMs === undefined) {
      this.store.delete(key);
    }
    return 1;
  }
}
describe('RedisLockAdapter', () => {
  let service: RedisLockAdapter;
  let redis: FakeRedis;
  beforeEach(async () => {
    redis = new FakeRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisLockAdapter, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    service = module.get<RedisLockAdapter>(RedisLockAdapter);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('acquires a free key and returns an ownership token', async () => {
    const token = await service.acquire('site-session', 60000);
    expect(token).toEqual(expect.any(String));
  });
  it('refuses a second acquire while the first still holds the lock (conflict)', async () => {
    const first = await service.acquire('site-session', 60000);
    const second = await service.acquire('site-session', 60000);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
  it('lets a different key be acquired independently', async () => {
    const a = await service.acquire('key-a', 60000);
    const b = await service.acquire('key-b', 60000);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
  it('releases the lock so a subsequent acquire can succeed', async () => {
    const token = await service.acquire('site-session', 60000);
    const released = await service.release('site-session', token!);
    const reacquired = await service.acquire('site-session', 60000);
    expect(released).toBe(true);
    expect(reacquired).not.toBeNull();
  });
  it('refuses to release when the token does not match the current holder', async () => {
    await service.acquire('site-session', 60000);
    const released = await service.release('site-session', 'not-the-owner');
    const stillHeld = await service.acquire('site-session', 60000);
    expect(released).toBe(false);
    expect(stillHeld).toBeNull();
  });
  it('extends the TTL while the token still owns the key', async () => {
    const token = await service.acquire('site-session', 60000);
    const extended = await service.extend('site-session', token!, 90000);
    expect(extended).toBe(true);
  });
  it('refuses to extend when the token does not match the current holder', async () => {
    await service.acquire('site-session', 60000);
    const extended = await service.extend(
      'site-session',
      'not-the-owner',
      90000,
    );
    expect(extended).toBe(false);
  });
  it('does not release the key as a side effect of extending it', async () => {
    const token = await service.acquire('site-session', 60000);
    await service.extend('site-session', token!, 90000);
    const reacquired = await service.acquire('site-session', 60000);
    expect(reacquired).toBeNull();
  });
  it('closes the redis connection on module destroy', async () => {
    await service.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
