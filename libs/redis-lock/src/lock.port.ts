/* v8 ignore file */
export interface LockPort {
  acquire(key: string, ttlMs: number): Promise<string | null>;
  release(key: string, token: string): Promise<boolean>;
  extend(key: string, token: string, ttlMs: number): Promise<boolean>;
}
