import type { Dirent } from 'node:fs';
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import type { ConfigService } from '@app/config';
import type { StorageListOptions, StoragePort } from '../storage.port.js';
export class LocalFilesystemStorageAdapter implements StoragePort {
  constructor(private readonly config: ConfigService) {}
  async read(key: string): Promise<string> {
    return readFile(this.resolve(key), 'utf8');
  }
  async write(key: string, content: string): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  async append(key: string, content: string): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, content);
  }
  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  async list(
    prefix: string,
    { recursive = true }: StorageListOptions = {},
  ): Promise<string[]> {
    const rootPath = this.resolve(prefix);
    const keys: string[] = [];
    await this.walk(rootPath, keys, recursive);
    return keys;
  }
  async copy(sourceKey: string, destKey: string): Promise<void> {
    const destPath = this.resolve(destKey);
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(this.resolve(sourceKey), destPath);
  }
  private resolve(key: string): string {
    const resolved = join(this.config.localStorageDir, key);
    const rel = relative(this.config.localStorageDir, resolved);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(`Storage key escapes the storage root: ${key}`);
    }
    return resolved;
  }
  private async walk(
    dirPath: string,
    keys: string[],
    recursive: boolean,
  ): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          await this.walk(entryPath, keys, recursive);
        }
      } else {
        keys.push(relative(this.config.localStorageDir, entryPath));
      }
    }
  }
}
