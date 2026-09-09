import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class ConfigService {
  constructor(private readonly nestConfig: NestConfigService) {}
  get kafkaBrokers(): string[] {
    return this.getString('KAFKA_BROKERS')
      .split(',')
      .map((broker) => broker.trim());
  }
  get redisUrl(): string {
    return this.getString('REDIS_URL');
  }
  get siteBaseListingUrl(): string | undefined {
    return this.nestConfig.get<string>('SITE_BASE_LISTING_URL') || undefined;
  }
  get siteConfigPath(): string {
    return this.getString('SITE_CONFIG_PATH');
  }
  get browserHeadless(): boolean {
    return this.getString('BROWSER_HEADLESS') === 'true';
  }
  get browserProfileDir(): string {
    return this.getString('BROWSER_PROFILE_DIR');
  }
  get siteRequiresLogin(): boolean {
    return this.getString('SITE_REQUIRES_LOGIN') === 'true';
  }
  get localStorageDir(): string {
    return this.getString('LOCAL_STORAGE_DIR');
  }
  get lockTtlMs(): number {
    return this.getNumber('LOCK_TTL_MS');
  }
  get fileLockTtlMs(): number {
    return this.getNumber('FILE_LOCK_TTL_MS');
  }
  get fileLockRetryIntervalMs(): number {
    return this.getNumber('FILE_LOCK_RETRY_INTERVAL_MS');
  }
  get fileLockMaxWaitMs(): number {
    return this.getNumber('FILE_LOCK_MAX_WAIT_MS');
  }
  get maxListingPages(): number {
    return this.getNumber('MAX_LISTING_PAGES');
  }
  get maxRecordExtractions(): number {
    return this.getNumber('MAX_RECORD_EXTRACTIONS');
  }
  get maxExtractionAttempts(): number {
    return this.getNumber('MAX_EXTRACTION_ATTEMPTS');
  }
  get fixedWaitMs(): number {
    return this.getNumber('FIXED_WAIT_MS');
  }
  get recordDetailWaitMinSec(): number {
    return this.getNumber('RECORD_DETAIL_WAIT_MIN_SEC');
  }
  get recordDetailWaitMaxSec(): number {
    return this.getNumber('RECORD_DETAIL_WAIT_MAX_SEC');
  }
  get kafkaConsumerSessionTimeoutMs(): number {
    return this.getNumber('KAFKA_CONSUMER_SESSION_TIMEOUT_MS');
  }
  get kafkaTopicRetentionMs(): number {
    return this.getNumber('KAFKA_TOPIC_RETENTION_MS');
  }
  get kafkaDlqRetentionMs(): number {
    return this.getNumber('KAFKA_DLQ_RETENTION_MS');
  }
  get kafkaHandlerMaxAttempts(): number {
    return this.getNumber('KAFKA_HANDLER_MAX_ATTEMPTS');
  }
  get kafkaHandlerRetryBaseMs(): number {
    return this.getNumber('KAFKA_HANDLER_RETRY_BASE_MS');
  }
  get browserCloseWaitMinMs(): number {
    return this.getNumber('BROWSER_CLOSE_WAIT_MIN_MS');
  }
  get browserCloseWaitMaxMs(): number {
    return this.getNumber('BROWSER_CLOSE_WAIT_MAX_MS');
  }
  get queueProvider(): string {
    return this.getString('QUEUE_PROVIDER');
  }
  get lockProvider(): string {
    return this.getString('LOCK_PROVIDER');
  }
  get storageProvider(): string {
    return this.getString('STORAGE_PROVIDER');
  }
  private getString(key: string): string {
    const value = this.nestConfig.get<string>(key);
    if (value === undefined) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value;
  }
  private getNumber(key: string): number {
    return Number(this.getString(key));
  }
}
