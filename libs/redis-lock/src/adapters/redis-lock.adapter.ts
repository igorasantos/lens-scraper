import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis-client.token.js';
import type { LockPort } from '../lock.port.js';
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;
const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;
@Injectable()
export class RedisLockAdapter implements LockPort, OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }
  async release(key: string, token: string): Promise<boolean> {
    const result = await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
    return result === 1;
  }
  async extend(key: string, token: string, ttlMs: number): Promise<boolean> {
    const result = await this.redis.eval(EXTEND_SCRIPT, 1, key, token, ttlMs);
    return result === 1;
  }
}
