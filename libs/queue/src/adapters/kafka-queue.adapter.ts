import type { OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { QueuePort } from '../queue.port.js';
export class KafkaQueueAdapter implements QueuePort, OnModuleDestroy {
  private readonly producer: KafkaJS.Producer;
  private connected = false;
  constructor(brokers: string[]) {
    const kafka = new KafkaJS.Kafka({
      kafkaJS: { brokers, logLevel: KafkaJS.logLevel.NOTHING },
    });
    this.producer = kafka.producer({ kafkaJS: {} });
  }
  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }
  async publish(topic: string, payload: unknown): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}
