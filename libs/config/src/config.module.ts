import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { ConfigService } from './config.service.js';
const positiveInt = Joi.string().pattern(/^\d+$/);
const envSchema = Joi.object({
  KAFKA_BROKERS: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  SITE_BASE_LISTING_URL: Joi.string().allow('').optional(),
  SITE_CONFIG_PATH: Joi.string().required(),
  BROWSER_HEADLESS: Joi.string().valid('true', 'false').default('true'),
  BROWSER_PROFILE_DIR: Joi.string().required(),
  SITE_REQUIRES_LOGIN: Joi.string().valid('true', 'false').default('false'),
  LOCAL_STORAGE_DIR: Joi.string().required(),
  LOCK_TTL_MS: positiveInt.required(),
  FILE_LOCK_TTL_MS: positiveInt.required(),
  FILE_LOCK_RETRY_INTERVAL_MS: positiveInt.required(),
  FILE_LOCK_MAX_WAIT_MS: positiveInt.required(),
  MAX_LISTING_PAGES: positiveInt.required(),
  MAX_RECORD_EXTRACTIONS: positiveInt.required(),
  MAX_EXTRACTION_ATTEMPTS: positiveInt.required(),
  FIXED_WAIT_MS: positiveInt.required(),
  RECORD_DETAIL_WAIT_MIN_SEC: positiveInt.required(),
  RECORD_DETAIL_WAIT_MAX_SEC: positiveInt.required(),
  LOCK_BUSY_REQUEUE_WAIT_MS: positiveInt.required(),
  KAFKA_CONSUMER_SESSION_TIMEOUT_MS: positiveInt.required(),
  KAFKA_TOPIC_RETENTION_MS: positiveInt.required(),
  BROWSER_CLOSE_WAIT_MIN_MS: positiveInt.required(),
  BROWSER_CLOSE_WAIT_MAX_MS: positiveInt.required(),
  QUEUE_PROVIDER: Joi.string().default('local'),
  LOCK_PROVIDER: Joi.string().default('local'),
  STORAGE_PROVIDER: Joi.string().default('local'),
}).unknown(true);
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const { error, value } = envSchema.validate(config, {
          abortEarly: false,
          convert: false,
        });
        if (error) {
          throw new Error(`Invalid environment variables: ${error.message}`);
        }
        return value as Record<string, unknown>;
      },
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
