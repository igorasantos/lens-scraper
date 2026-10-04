import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { StorageService } from './storage.service.js';
export interface DeadLetterTarget {
  runId: string;
  recordId?: string;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}
  async run<T>(
    topic: string,
    target: DeadLetterTarget,
    payload: T,
    handle: () => Promise<void>,
  ): Promise<void> {
    const maxAttempts = this.config.kafkaHandlerMaxAttempts;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await handle();
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Handler for ${topic} failed on attempt ${attempt}/${maxAttempts}: ${String(error)}`,
        );
        if (attempt < maxAttempts) {
          await sleep(this.config.kafkaHandlerRetryBaseMs * 2 ** (attempt - 1));
        }
      }
    }
    await this.writeDeadLetter(topic, target, payload, maxAttempts, lastError);
  }
  private async writeDeadLetter(
    topic: string,
    target: DeadLetterTarget,
    payload: unknown,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const key =
      target.recordId !== undefined
        ? await this.storage.appendDeadLetterRecordId(
            target.runId,
            topic,
            target.recordId,
          )
        : await this.storage.appendDeadLetterPayload(target.runId, topic, {
            payload,
            attempts,
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            failedAt: new Date().toISOString(),
          });
    this.logger.error(
      `Exhausted ${attempts} attempt(s) for ${topic}; wrote dead letter to ${key}: ${String(error)}`,
    );
  }
}
