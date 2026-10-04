import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@app/config';
import { QueueService } from './queue.service.js';
import { QUEUE_PORT } from './queue-port.token.js';
import { KafkaQueueAdapter } from './adapters/kafka-queue.adapter.js';
import { provisionTopicRetention } from './topic-retention.provisioner.js';

@Module({
  imports: [ConfigModule],
  providers: [
    QueueService,
    {
      provide: QUEUE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.queueProvider !== 'local') {
          throw new Error(
            `Unsupported QUEUE_PROVIDER: ${config.queueProvider} (only 'local' is implemented)`,
          );
        }
        return new KafkaQueueAdapter(config.kafkaBrokers);
      },
    },
  ],
  exports: [QueueService, QUEUE_PORT],
  /* v8 ignore start */
})
/* v8 ignore stop */
export class QueueModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}
  async onModuleInit(): Promise<void> {
    if (this.config.queueProvider !== 'local') {
      return;
    }
    await provisionTopicRetention(
      this.config.kafkaBrokers,
      this.config.kafkaTopicRetentionMs,
    );
  }
}
