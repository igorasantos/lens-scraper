import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { ConfigService } from '@app/config';
import { QUEUE_PORT, QueueService } from '@app/queue';
import { SiteConfigService } from '@app/site';
import { StorageService } from '@app/storage';
import { WorkerModule } from './../src/worker.module.js';
import { TitlesController } from './../src/titles/titles.controller.js';
import { ListingController } from './../src/listing/listing.controller.js';

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
    fileLockTtlMs: Number(process.env.FILE_LOCK_TTL_MS),
    fileLockRetryIntervalMs: Number(process.env.FILE_LOCK_RETRY_INTERVAL_MS),
    fileLockMaxWaitMs: Number(process.env.FILE_LOCK_MAX_WAIT_MS),
    maxListingPages: Number(process.env.MAX_LISTING_PAGES),
    maxRecordExtractions: Number(process.env.MAX_RECORD_EXTRACTIONS),
    maxExtractionAttempts: Number(process.env.MAX_EXTRACTION_ATTEMPTS),
    fixedWaitMs: Number(process.env.FIXED_WAIT_MS),
    recordDetailWaitMinSec: Number(process.env.RECORD_DETAIL_WAIT_MIN_SEC),
    recordDetailWaitMaxSec: Number(process.env.RECORD_DETAIL_WAIT_MAX_SEC),
    lockBusyRequeueWaitMs: Number(process.env.LOCK_BUSY_REQUEUE_WAIT_MS),
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

describe('WorkerModule (e2e)', () => {
  let app: INestApplication<App>;
  let controller: TitlesController;
  let listingController: ListingController;
  let storage: StorageService;
  let siteConfig: SiteConfigService;
  let storageDir: string;
  let queue: {
    publishRecordTitleExtractsBatch: ReturnType<typeof vi.fn>;
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishRecordLanguageClassifyBatch: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'lens-scraper-worker-e2e-'));
    queue = {
      publishRecordTitleExtractsBatch: vi.fn().mockResolvedValue(undefined),
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishRecordLanguageClassifyBatch: vi.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(buildTestConfig(storageDir))
      .overrideProvider(QueueService)
      .useValue(queue)
      .overrideProvider(QUEUE_PORT)
      .useValue({ publish: vi.fn().mockResolvedValue(undefined) })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    controller = app.get(TitlesController);
    listingController = app.get(ListingController);
    storage = app.get(StorageService);
    siteConfig = app.get(SiteConfigService);
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });
  describe('record titles dedup/filter pipeline', () => {
    it('dedupes, sorts and then filters titles through real storage', async () => {
      await storage.appendRawRecordTitle('widget alpha');
      await storage.appendRawRecordTitle('widget alpha');
      await storage.appendRawRecordTitle('gizmo gamma');
      await storage.appendRawRecordTitle('gadget beta');

      await controller.handleRecordTitlesDedupSort({ runId: 'run-e2e-1' });
      expect(await storage.readDedupSortedRecordTitles()).toEqual([
        'gadget beta',
        'gizmo gamma',
        'widget alpha',
      ]);

      await controller.handleRecordTitlesFilter({
        runId: 'run-e2e-1',
        substrings: ['WIDGET'],
      });
      expect(await storage.readFilteredRecordTitles()).toEqual(
        new Set(['gadget beta', 'gizmo gamma']),
      );
    });
  });
  describe('record detail catalog recycling', () => {
    async function writeCatalogFile(
      relativePath: string,
      html: string,
    ): Promise<string> {
      const filePath = join(
        storageDir,
        siteConfig.recordDetailCatalogDir,
        relativePath,
      );
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, html);
      return filePath;
    }
    it('moves catalog hits into the record detail buckets and only dispatches the rest for scraping', async () => {
      const runId = 'run-e2e-recycle';
      await storage.writeListingIds(runId, ['1', '2', '3']);
      const catalogEn = await writeCatalogFile('en/2.html', '<div>2</div>');
      const catalogPt = await writeCatalogFile(
        'batch-a/pt/3.html',
        '<div>3</div>',
      );
      await writeCatalogFile('en/99.html', '<div>99</div>');

      await listingController.handleRecordsRecycle({ runId });

      expect(await storage.readRecycledListingIds(runId)).toEqual(['2', '3']);
      expect(await storage.read(storage.toScrapeListingIdsPath(runId))).toBe(
        '1\n',
      );
      expect(await storage.read(storage.recordDetailPath('en', '2'))).toBe(
        '<div>2</div>',
      );
      expect(await storage.read(storage.recordDetailPath('pt', '3'))).toBe(
        '<div>3</div>',
      );
      await expect(readFile(catalogEn)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expect(readFile(catalogPt)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      const recordIds = await storage.readRecordIds();
      expect(recordIds.has('2')).toBe(true);
      expect(recordIds.has('3')).toBe(true);
      expect(recordIds.has('1')).toBe(false);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledTimes(1);
      expect(
        queue.publishRecordDetailsBatch.mock.calls[0][0].map(
          (entry: { recordId: string }) => entry.recordId,
        ),
      ).toEqual(['1']);
      expect((await storage.readRecordDetailCatalog()).has('99')).toBe(true);
    });
  });
});
