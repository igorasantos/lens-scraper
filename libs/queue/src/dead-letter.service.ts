import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { QUEUE_PORT } from './queue-port.token.js';
import type { QueuePort } from './queue.port.js';
import type { DeadLetterEnvelope } from './messages.js';
import { toDeadLetterTopic } from './topics.js';
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  constructor(
    @Inject(QUEUE_PORT)
    private readonly queuePort: QueuePort,
    private readonly config: ConfigService,
  ) {}
  async run<T>(
    topic: string,
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
    await this.sendToDeadLetter(topic, payload, maxAttempts, lastError);
  }
  private async sendToDeadLetter(
    topic: string,
    payload: unknown,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const deadLetterTopic = toDeadLetterTopic(topic);
    const envelope: DeadLetterEnvelope = {
      topic,
      payload,
      attempts,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      failedAt: new Date().toISOString(),
    };
    await this.queuePort.publish(deadLetterTopic, envelope);
    this.logger.error(
      `Exhausted ${attempts} attempt(s) for ${topic}; published to ${deadLetterTopic}`,
    );
  }
}
