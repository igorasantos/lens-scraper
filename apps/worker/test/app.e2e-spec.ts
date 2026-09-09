import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { ConfigService } from '@app/config';
import { QUEUE_PORT, QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { WorkerModule } from './../src/worker.module.js';
import { WorkerController } from './../src/worker.controller.js';

function buildTestConfig(localStorageDir: string): ConfigService {
  return {
    kafkaBrokers:
      process.env.KAFKA_BROKERS?.split(',').map((b) => b.trim()) ?? [],
    redisUrl: process.env.REDIS_URL ?? '',
    siteBaseListingUrl: process.env.SITE_BASE_LISTING_URL || undefined,
    siteConfigPath: process.env.SITE_CONFIG_PATH ?? '',
    browserHeadless: process.env.BROWSER_HEADLESS === 'true',
    browserProfileDir: process.env.BROWSER_PROFILE_DIR ?? '',
    siteRequiresLogin: process.env.SITE_REQUIRES_LOGIN === 'true',
    localStorageDir,
    lockTtlMs: Number(process.env.LOCK_TTL_MS),
    maxListingPages: Number(process.env.MAX_LISTING_PAGES),
    maxRecordExtractions: Number(process.env.MAX_RECORD_EXTRACTIONS),
    maxExtractionAttempts: Number(process.env.MAX_EXTRACTION_ATTEMPTS),
    fixedWaitMs: Number(process.env.FIXED_WAIT_MS),
    recordDetailWaitMinSec: Number(process.env.RECORD_DETAIL_WAIT_MIN_SEC),
    recordDetailWaitMaxSec: Number(process.env.RECORD_DETAIL_WAIT_MAX_SEC),
    kafkaConsumerSessionTimeoutMs: Number(
      process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS,
    ),
    kafkaTopicRetentionMs: Number(process.env.KAFKA_TOPIC_RETENTION_MS),
    kafkaHandlerMaxAttempts: Number(process.env.KAFKA_HANDLER_MAX_ATTEMPTS),
    kafkaHandlerRetryBaseMs: Number(process.env.KAFKA_HANDLER_RETRY_BASE_MS),
    browserCloseWaitMinMs: Number(process.env.BROWSER_CLOSE_WAIT_MIN_MS),
    browserCloseWaitMaxMs: Number(process.env.BROWSER_CLOSE_WAIT_MAX_MS),
    queueProvider: 'e2e-test-noop',
    lockProvider: process.env.LOCK_PROVIDER ?? 'local',
    storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
  } as unknown as ConfigService;
}

describe('WorkerController (e2e)', () => {
  let app: INestApplication<App>;
  let controller: WorkerController;
  let storage: StorageService;
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'lens-scraper-worker-e2e-'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(buildTestConfig(storageDir))
      .overrideProvider(QueueService)
      .useValue({
        publishRecordTitleExtractsBatch: vi.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(QUEUE_PORT)
      .useValue({ publish: vi.fn().mockResolvedValue(undefined) })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    controller = app.get(WorkerController);
    storage = app.get(StorageService);
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });
  describe('record titles dedup/filter pipeline', () => {
    it('dedupes, sorts and then filters titles through real storage', async () => {
      await storage.appendRawRecordTitle('Widget Alpha');
      await storage.appendRawRecordTitle('Widget Alpha');
      await storage.appendRawRecordTitle('Gizmo Gamma');
      await storage.appendRawRecordTitle('Gadget Beta');

      await controller.handleRecordTitlesDedupSort({ runId: 'run-e2e-1' });
      expect(await storage.readDedupSortedRecordTitles()).toEqual([
        'Gadget Beta',
        'Gizmo Gamma',
        'Widget Alpha',
      ]);

      await controller.handleRecordTitlesFilter({
        runId: 'run-e2e-1',
        substrings: ['widget'],
      });
      expect(await storage.readFilteredRecordTitles()).toEqual(
        new Set(['Gadget Beta', 'Gizmo Gamma']),
      );
    });
  });
});
