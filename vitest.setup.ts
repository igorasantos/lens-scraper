const defaults: Record<string, string> = {
  KAFKA_BROKERS: 'localhost:9092',
  REDIS_URL: 'redis://localhost:6379',
  BROWSER_HEADLESS: 'true',
  BROWSER_PROFILE_DIR: './browser-profile',
  SITE_REQUIRES_LOGIN: 'false',
  LOCAL_STORAGE_DIR: './data',
  LOCK_TTL_MS: '90000',
  MAX_LISTING_PAGES: '50',
  MAX_RECORD_EXTRACTIONS: '20',
  MAX_EXTRACTION_ATTEMPTS: '3',
  FIXED_WAIT_MS: '3000',
  RECORD_DETAIL_WAIT_MIN_SEC: '2',
  RECORD_DETAIL_WAIT_MAX_SEC: '5',
  LOCK_BUSY_REQUEUE_WAIT_MS: '5000',
  KAFKA_CONSUMER_SESSION_TIMEOUT_MS: '60000',
  KAFKA_TOPIC_RETENTION_MS: '3600000',
  BROWSER_CLOSE_WAIT_MIN_MS: '3000',
  BROWSER_CLOSE_WAIT_MAX_MS: '7000',
};
for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
