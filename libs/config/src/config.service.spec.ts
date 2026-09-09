import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ConfigService } from './config.service.js';
const env: Record<string, string> = {
  KAFKA_BROKERS: 'localhost:9092,localhost:9093',
  REDIS_URL: 'redis://localhost:6379',
  BROWSER_HEADLESS: 'false',
  BROWSER_PROFILE_DIR: './browser-profile',
  SITE_REQUIRES_LOGIN: 'false',
  LOCAL_STORAGE_DIR: './data',
  LOCK_TTL_MS: '90000',
  FILE_LOCK_TTL_MS: '5000',
  FILE_LOCK_RETRY_INTERVAL_MS: '50',
  FILE_LOCK_MAX_WAIT_MS: '5000',
  MAX_LISTING_PAGES: '50',
  MAX_RECORD_EXTRACTIONS: '20',
  MAX_EXTRACTION_ATTEMPTS: '3',
  FIXED_WAIT_MS: '3000',
  RECORD_DETAIL_WAIT_MIN_SEC: '2',
  RECORD_DETAIL_WAIT_MAX_SEC: '5',
  KAFKA_CONSUMER_SESSION_TIMEOUT_MS: '60000',
  KAFKA_TOPIC_RETENTION_MS: '3600000',
  KAFKA_DLQ_RETENTION_MS: '604800000',
  KAFKA_HANDLER_MAX_ATTEMPTS: '3',
  KAFKA_HANDLER_RETRY_BASE_MS: '500',
  BROWSER_CLOSE_WAIT_MIN_MS: '3000',
  BROWSER_CLOSE_WAIT_MAX_MS: '7000',
  QUEUE_PROVIDER: 'local',
  LOCK_PROVIDER: 'local',
  STORAGE_PROVIDER: 'local',
  SITE_CONFIG_PATH: './config/site.config.example.json',
};
async function buildService(
  overrides: Record<string, string | undefined> = {},
): Promise<ConfigService> {
  const values = { ...env, ...overrides };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ConfigService,
      {
        provide: NestConfigService,
        useValue: { get: (key: string) => values[key] },
      },
    ],
  }).compile();
  return module.get<ConfigService>(ConfigService);
}
describe('ConfigService', () => {
  it('should be defined', async () => {
    expect(await buildService()).toBeDefined();
  });
  it('splits KAFKA_BROKERS into a trimmed list', async () => {
    const service = await buildService();
    expect(service.kafkaBrokers).toEqual(['localhost:9092', 'localhost:9093']);
  });
  it('parses BROWSER_HEADLESS as a boolean', async () => {
    const service = await buildService();
    expect(service.browserHeadless).toBe(false);
  });
  it('exposes the browser profile dir and local storage dir', async () => {
    const service = await buildService();
    expect(service.browserProfileDir).toBe('./browser-profile');
    expect(service.localStorageDir).toBe('./data');
  });
  it('parses SITE_REQUIRES_LOGIN as a boolean', async () => {
    const service = await buildService();
    expect(service.siteRequiresLogin).toBe(false);
    const withLogin = await buildService({
      SITE_REQUIRES_LOGIN: 'true',
    });
    expect(withLogin.siteRequiresLogin).toBe(true);
  });
  it('parses numeric env vars as numbers', async () => {
    const service = await buildService();
    expect(service.lockTtlMs).toBe(90000);
    expect(service.fileLockTtlMs).toBe(5000);
    expect(service.fileLockRetryIntervalMs).toBe(50);
    expect(service.fileLockMaxWaitMs).toBe(5000);
    expect(service.maxListingPages).toBe(50);
    expect(service.maxRecordExtractions).toBe(20);
    expect(service.maxExtractionAttempts).toBe(3);
    expect(service.fixedWaitMs).toBe(3000);
    expect(service.recordDetailWaitMinSec).toBe(2);
    expect(service.recordDetailWaitMaxSec).toBe(5);
    expect(service.kafkaConsumerSessionTimeoutMs).toBe(60000);
    expect(service.kafkaTopicRetentionMs).toBe(3600000);
    expect(service.kafkaDlqRetentionMs).toBe(604800000);
    expect(service.kafkaHandlerMaxAttempts).toBe(3);
    expect(service.kafkaHandlerRetryBaseMs).toBe(500);
    expect(service.browserCloseWaitMinMs).toBe(3000);
    expect(service.browserCloseWaitMaxMs).toBe(7000);
  });
  it('returns undefined for an unset optional var', async () => {
    const service = await buildService({
      SITE_BASE_LISTING_URL: undefined,
    });
    expect(service.siteBaseListingUrl).toBeUndefined();
  });
  it('exposes the site config path', async () => {
    const service = await buildService();
    expect(service.siteConfigPath).toBe('./config/site.config.example.json');
  });
  it('exposes the provider selection for each infra port', async () => {
    const service = await buildService();
    expect(service.queueProvider).toBe('local');
    expect(service.lockProvider).toBe('local');
    expect(service.storageProvider).toBe('local');
  });
  it('throws when a required env var is missing', async () => {
    const service = await buildService({ REDIS_URL: undefined });
    expect(() => service.redisUrl).toThrow(
      'Missing required env var: REDIS_URL',
    );
  });
});
