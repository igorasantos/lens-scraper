import type { ConfigService } from '@app/config';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockRun = vi.fn().mockResolvedValue(undefined);
const mockConsumer = vi.fn(() => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
  subscribe: mockSubscribe,
  run: mockRun,
}));
const MockKafka = vi.fn(function MockKafka(this: {
  consumer: typeof mockConsumer;
}) {
  this.consumer = mockConsumer;
});
vi.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: { Kafka: MockKafka, logLevel: { NOTHING: 0 } },
}));
const { KafkaConsumerTransportStrategy, createConsumerTransportStrategy } =
  await import('./consumer-transport.factory.js');

function fakeConfig(overrides: Partial<ConfigService> = {}): ConfigService {
  return {
    queueProvider: 'local',
    kafkaBrokers: ['localhost:9092'],
    kafkaConsumerSessionTimeoutMs: 60000,
    ...overrides,
  } as unknown as ConfigService;
}

describe('KafkaConsumerTransportStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a consumer against the configured brokers and session timeout', () => {
    new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    expect(MockKafka).toHaveBeenCalledWith({
      kafkaJS: { brokers: ['broker:9092'], logLevel: 0 },
    });
  });

  it('connects, subscribes to the registered handler topics and starts consuming on listen()', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    strategy.addHandler('scrape.record.detail', vi.fn(), true);
    const callback = vi.fn();
    await strategy.listen(callback);
    expect(mockConsumer).toHaveBeenCalledWith({
      kafkaJS: {
        groupId: 'lens-scraper-detail-scraper',
        sessionTimeout: 60000,
      },
    });
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith({
      topics: ['scrape.record.detail'],
    });
    expect(mockRun).toHaveBeenCalledWith({ eachMessage: expect.any(Function) });
    expect(callback).toHaveBeenCalledWith();
  });

  it('does not subscribe when no handlers are registered', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    await strategy.listen(vi.fn());
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('forwards listen() failures to the callback instead of throwing', async () => {
    mockConnect.mockRejectedValueOnce(new Error('boom'));
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    const callback = vi.fn();
    await strategy.listen(callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('dispatches an incoming message to the handler registered for its topic', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    const handler = vi.fn().mockResolvedValue(undefined);
    strategy.addHandler('scrape.record.detail', handler, true);
    await strategy.listen(vi.fn());
    const eachMessage = mockRun.mock.calls[0][0].eachMessage;
    await eachMessage({
      topic: 'scrape.record.detail',
      partition: 0,
      message: { value: Buffer.from(JSON.stringify({ recordId: '1' })) },
      heartbeat: vi.fn(),
    });
    expect(handler).toHaveBeenCalledWith({ recordId: '1' }, expect.anything());
  });

  it('dispatches a tombstone message (no value) as undefined data', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    const handler = vi.fn().mockResolvedValue(undefined);
    strategy.addHandler('scrape.record.detail', handler, true);
    await strategy.listen(vi.fn());
    const eachMessage = mockRun.mock.calls[0][0].eachMessage;
    await eachMessage({
      topic: 'scrape.record.detail',
      partition: 0,
      message: { value: null },
      heartbeat: vi.fn(),
    });
    expect(handler).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it('disconnects the consumer on close()', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    await strategy.listen(vi.fn());
    await strategy.close();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('close() is a no-op when never listened', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    await strategy.close();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('on() is not supported', () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    expect(() => strategy.on()).toThrow(
      'Method is not supported for this strategy',
    );
  });

  it('unwrap() throws before listen() has run', () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    expect(() => strategy.unwrap()).toThrow(/Not initialized/);
  });

  it('unwrap() returns the underlying consumer after listen()', async () => {
    const strategy = new KafkaConsumerTransportStrategy(['broker:9092'], 60000);
    await strategy.listen(vi.fn());
    expect(strategy.unwrap()).toBe(mockConsumer.mock.results[0]?.value);
  });
});

describe('createConsumerTransportStrategy', () => {
  it('wraps a KafkaConsumerTransportStrategy in a CustomStrategy', () => {
    const { strategy } = createConsumerTransportStrategy(fakeConfig());
    expect(strategy).toBeInstanceOf(KafkaConsumerTransportStrategy);
  });

  it('throws when QUEUE_PROVIDER is not local', () => {
    expect(() =>
      createConsumerTransportStrategy(fakeConfig({ queueProvider: 'aws' })),
    ).toThrow(/Unsupported QUEUE_PROVIDER: aws/);
  });
});
