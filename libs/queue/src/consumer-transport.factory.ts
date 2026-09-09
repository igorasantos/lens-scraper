import {
  Server,
  KafkaContext,
  type CustomStrategy,
} from '@nestjs/microservices';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { ConfigService } from '@app/config';

export class KafkaConsumerTransportStrategy extends Server {
  private readonly kafka: KafkaJS.Kafka;
  private consumer: KafkaJS.Consumer | null = null;

  constructor(
    brokers: string[],
    private readonly sessionTimeout: number,
  ) {
    super();
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: { brokers, logLevel: KafkaJS.logLevel.NOTHING },
    });
  }

  async listen(callback: (error?: unknown) => unknown): Promise<void> {
    try {
      const consumer = this.kafka.consumer({
        kafkaJS: {
          groupId: 'lens-scraper-detail-scraper',
          sessionTimeout: this.sessionTimeout,
        },
      });
      this.consumer = consumer;
      await consumer.connect();
      const topics = [...this.messageHandlers.keys()];
      if (topics.length > 0) {
        await consumer.subscribe({ topics });
      }
      await consumer.run({
        eachMessage: (payload) => this.handleMessage(payload),
      });
      callback();
    } catch (error) {
      callback(error);
    }
  }

  async close(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  on(): void {
    throw new Error('Method is not supported for this strategy');
  }

  unwrap<T>(): T {
    if (!this.consumer) {
      throw new Error(
        'Not initialized. Please call the "listen"/"startAllMicroservices" method before accessing the server.',
      );
    }
    return this.consumer as unknown as T;
  }

  private async handleMessage(
    payload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const { topic, partition, message } = payload;
    const data: unknown = message.value
      ? JSON.parse(message.value.toString())
      : undefined;
    const context = new KafkaContext([
      message,
      partition,
      topic,
      this.consumer,
      payload.heartbeat,
      undefined,
    ]);
    await this.handleEvent(topic, { pattern: topic, data }, context);
  }
}

export function createConsumerTransportStrategy(
  config: ConfigService,
): CustomStrategy {
  if (config.queueProvider !== 'local') {
    throw new Error(
      `Unsupported QUEUE_PROVIDER: ${config.queueProvider} (only 'local' is implemented)`,
    );
  }
  return {
    strategy: new KafkaConsumerTransportStrategy(
      config.kafkaBrokers,
      config.kafkaConsumerSessionTimeoutMs,
    ),
  };
}
