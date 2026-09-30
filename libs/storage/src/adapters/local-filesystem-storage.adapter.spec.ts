import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ConfigService } from '@app/config';
import { LocalFilesystemStorageAdapter } from './local-filesystem-storage.adapter.js';
describe('LocalFilesystemStorageAdapter', () => {
  let localStorageDir: string;
  let adapter: LocalFilesystemStorageAdapter;
  beforeEach(async () => {
    localStorageDir = await mkdtemp(
      join(tmpdir(), 'lens-scraper-storage-adapter-'),
    );
    adapter = new LocalFilesystemStorageAdapter({
      localStorageDir,
    } as ConfigService);
  });
  afterEach(async () => {
    await rm(localStorageDir, { recursive: true, force: true });
  });
  it('read() rejects with ENOENT when the key does not exist', async () => {
    await expect(adapter.read('missing.txt')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('write() creates parent directories and writes the content, resolved against localStorageDir', async () => {
    await adapter.write('runs/run-1/listing-ids.txt', '111\n222\n');
    await expect(
      readFile(
        join(localStorageDir, 'runs', 'run-1', 'listing-ids.txt'),
        'utf8',
      ),
    ).resolves.toBe('111\n222\n');
  });
  it('write() overwrites an existing key', async () => {
    await adapter.write('records_en.txt', 'first');
    await adapter.write('records_en.txt', 'second');
    await expect(adapter.read('records_en.txt')).resolves.toBe('second');
  });
  it('append() creates the key when it does not exist yet', async () => {
    await adapter.append('records_en.txt', '111\n');
    await adapter.append('records_en.txt', '222\n');
    await expect(adapter.read('records_en.txt')).resolves.toBe('111\n222\n');
  });
  it('exists() returns false for a missing key and true once written', async () => {
    await expect(adapter.exists('sources.txt')).resolves.toBe(false);
    await adapter.write('sources.txt', 'acme\n');
    await expect(adapter.exists('sources.txt')).resolves.toBe(true);
  });
  it('remove() deletes an existing key', async () => {
    await adapter.write('records_xx.txt', '111\n');
    await adapter.remove('records_xx.txt');
    await expect(adapter.exists('records_xx.txt')).resolves.toBe(false);
  });
  it('remove() is idempotent — a no-op when the key does not exist', async () => {
    await expect(adapter.remove('missing.txt')).resolves.toBeUndefined();
  });
  it('exists() re-throws a non-ENOENT error instead of reporting the key as missing', async () => {
    await adapter.write('records.txt', 'hi');
    await expect(adapter.exists('records.txt/sub')).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
  it('remove() re-throws a non-ENOENT error', async () => {
    await adapter.write('records.txt', 'hi');
    await expect(adapter.remove('records.txt/sub')).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
  it('list() re-throws a non-ENOENT error while walking a prefix', async () => {
    await adapter.write('records.txt', 'hi');
    await expect(adapter.list('records.txt')).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
  it('list() returns every key recursively under a prefix', async () => {
    await adapter.write('1_records_raw/en/111.html', '<div>en 111</div>');
    await adapter.write('1_records_raw/en/222.html', '<div>en 222</div>');
    await adapter.write('1_records_raw/expired/333.html', '<div>expired</div>');
    await adapter.write('sources.txt', 'acme\n');
    const keys = await adapter.list('1_records_raw');
    expect(keys.sort()).toEqual(
      [
        join('1_records_raw', 'en', '111.html'),
        join('1_records_raw', 'en', '222.html'),
        join('1_records_raw', 'expired', '333.html'),
      ].sort(),
    );
  });
  it('list() returns an empty array when the prefix does not exist', async () => {
    await expect(adapter.list('1_records_raw')).resolves.toEqual([]);
  });
  it('list() with an empty prefix returns every key under localStorageDir', async () => {
    await adapter.write('records_en.txt', '111\n');
    await adapter.write('1_records_raw/en/111.html', '<div>en</div>');
    const keys = await adapter.list('');
    expect(keys.sort()).toEqual(
      ['records_en.txt', join('1_records_raw', 'en', '111.html')].sort(),
    );
  });
  it('list() with recursive: false returns only the files directly under the prefix', async () => {
    await adapter.write('records_en.txt', '111\n');
    await adapter.write('records_es.txt', '222\n');
    await adapter.write('1_records_raw/en/111.html', '<div>en</div>');
    const keys = await adapter.list('', { recursive: false });
    expect(keys.sort()).toEqual(['records_en.txt', 'records_es.txt']);
  });
  it('copy() copies the source into the destination, creating parent directories, leaving the source untouched', async () => {
    await adapter.write('1_records_raw/en/111.html', '<div>111</div>');
    await adapter.copy(
      '1_records_raw/en/111.html',
      '3_records_filtered/en/111.html',
    );
    await expect(adapter.read('3_records_filtered/en/111.html')).resolves.toBe(
      '<div>111</div>',
    );
    await expect(adapter.read('1_records_raw/en/111.html')).resolves.toBe(
      '<div>111</div>',
    );
  });
  it('resolves keys against localStorageDir, not the process cwd', async () => {
    await mkdir(dirname(join(localStorageDir, 'nested', 'file.txt')), {
      recursive: true,
    });
    await writeFile(join(localStorageDir, 'nested', 'file.txt'), 'from disk');
    await expect(adapter.read('nested/file.txt')).resolves.toBe('from disk');
  });
  it('rejects a key that traverses above localStorageDir', async () => {
    await expect(adapter.read('../../etc/passwd')).rejects.toThrow(
      'Storage key escapes the storage root',
    );
  });
  it('rejects a key that traverses above localStorageDir mid-path', async () => {
    await expect(adapter.write('runs/../../outside.txt', 'x')).rejects.toThrow(
      'Storage key escapes the storage root',
    );
  });
  it('treats a key with a leading slash as relative to localStorageDir, not the filesystem root', async () => {
    await adapter.write('etc/passwd', 'not the real one');
    await expect(adapter.read('/etc/passwd')).resolves.toBe('not the real one');
  });
});
