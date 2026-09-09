import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { StorageModule } from './storage.module.js';
import { STORAGE_PORT } from './storage-port.token.js';
import { StorageService } from './storage.service.js';
import { LocalFilesystemStorageAdapter } from './adapters/local-filesystem-storage.adapter.js';
describe('StorageModule', () => {
  function fakeConfig(overrides: Partial<ConfigService> = {}): ConfigService {
    return {
      localStorageDir: './data',
      storageProvider: 'local',
      redisUrl: 'redis://localhost:6379',
      lockProvider: 'local',
      siteConfigPath: './config/site.config.example.json',
      ...overrides,
    } as unknown as ConfigService;
  }
  it('wires STORAGE_PORT to a LocalFilesystemStorageAdapter and exports a working StorageService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue(fakeConfig())
      .compile();
    expect(module.get(STORAGE_PORT)).toBeInstanceOf(
      LocalFilesystemStorageAdapter,
    );
    expect(module.get(StorageService)).toBeInstanceOf(StorageService);
    await module.close();
  });
  it('rejects compilation when STORAGE_PROVIDER is not local', async () => {
    await expect(
      Test.createTestingModule({ imports: [StorageModule] })
        .overrideProvider(ConfigService)
        .useValue(fakeConfig({ storageProvider: 's3' }))
        .compile(),
    ).rejects.toThrow(/Unsupported STORAGE_PROVIDER: s3/);
  });
});
