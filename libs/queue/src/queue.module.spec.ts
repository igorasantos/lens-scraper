import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
vi.mock('@confluentinc/kafka-javascript', () => {
  const producer = () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
  });
  function MockKafka(): void {
    /* noop */
  }
  MockKafka.prototype.producer = producer;
  return { KafkaJS: { Kafka: MockKafka, logLevel: { NOTHING: 0 } } };
});
const provisionTopicRetention = vi.fn().mockResolvedValue(undefined);
vi.mock('./topic-retention.provisioner.js', () => ({
  provisionTopicRetention,
}));
const { QueueModule } = await import('./queue.module.js');
const { QUEUE_PORT } = await import('./queue-port.token.js');
const { KafkaQueueAdapter } = await import('./adapters/kafka-queue.adapter.js');
describe('QueueModule', () => {
  function fakeConfig(overrides: Partial<ConfigService> = {}): ConfigService {
    return {
      kafkaBrokers: ['broker:9092'],
      queueProvider: 'local',
      kafkaTopicRetentionMs: 3600000,
      ...overrides,
    } as unknown as ConfigService;
  }
  describe('DI wiring', () => {
    it('wires QUEUE_PORT to a KafkaQueueAdapter', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [QueueModule],
      })
        .overrideProvider(ConfigService)
        .useValue(fakeConfig())
        .compile();
      expect(module.get(QUEUE_PORT)).toBeInstanceOf(KafkaQueueAdapter);
      await module.close();
    });
    it('rejects compilation when QUEUE_PROVIDER is not local', async () => {
      await expect(
        Test.createTestingModule({ imports: [QueueModule] })
          .overrideProvider(ConfigService)
          .useValue(fakeConfig({ queueProvider: 'aws' }))
          .compile(),
      ).rejects.toThrow(/Unsupported QUEUE_PROVIDER: aws/);
    });
  });
  describe('onModuleInit', () => {
    beforeEach(() => {
      provisionTopicRetention.mockClear();
    });
    it('provisions topic retention when QUEUE_PROVIDER is local', async () => {
      const instance = new QueueModule(
        fakeConfig({
          kafkaBrokers: ['broker:9092'],
          kafkaTopicRetentionMs: 111,
        }),
      );
      await instance.onModuleInit();
      expect(provisionTopicRetention).toHaveBeenCalledWith(
        ['broker:9092'],
        111,
      );
    });
    it('skips provisioning when QUEUE_PROVIDER is not local', async () => {
      const instance = new QueueModule(fakeConfig({ queueProvider: 'aws' }));
      await instance.onModuleInit();
      expect(provisionTopicRetention).not.toHaveBeenCalled();
    });
  });
});
