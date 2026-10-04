/* v8 ignore file */
export interface StorageListOptions {
  recursive?: boolean;
}
export interface StoragePort {
  read(key: string): Promise<string>;
  write(key: string, content: string): Promise<void>;
  append(key: string, content: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  list(prefix: string, options?: StorageListOptions): Promise<string[]>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  move(sourceKey: string, destKey: string): Promise<void>;
}
