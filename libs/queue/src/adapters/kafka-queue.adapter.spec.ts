const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockProducer = vi.fn(() => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
  send: mockSend,
}));
const MockKafka = vi.fn(function MockKafka(this: {
  producer: typeof mockProducer;
}) {
  this.producer = mockProducer;
});
vi.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: { Kafka: MockKafka, logLevel: { NOTHING: 0 } },
}));
const { KafkaQueueAdapter } = await import('./kafka-queue.adapter.js');
describe('KafkaQueueAdapter', () => {
  let adapter: InstanceType<typeof KafkaQueueAdapter>;
  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new KafkaQueueAdapter(['broker:9092']);
  });
  it('builds a producer against the configured brokers', () => {
    expect(MockKafka).toHaveBeenCalledWith({
      kafkaJS: { brokers: ['broker:9092'], logLevel: 0 },
    });
    expect(mockProducer).toHaveBeenCalledWith({ kafkaJS: {} });
  });
  it('publish() connects lazily on first use and sends the payload to the given topic', async () => {
    await adapter.publish('scrape.record.detail', { recordId: '1' });
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      topic: 'scrape.record.detail',
      messages: [{ value: JSON.stringify({ recordId: '1' }) }],
    });
  });
  it('publish() only connects once across multiple calls', async () => {
    await adapter.publish('scrape.record.detail', { recordId: '1' });
    await adapter.publish('scrape.record.detail', { recordId: '2' });
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
  it('does not disconnect on module destroy when never connected', async () => {
    await adapter.onModuleDestroy();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
  it('disconnects the producer on module destroy once connected', async () => {
    await adapter.publish('scrape.record.detail', { recordId: '1' });
    await adapter.onModuleDestroy();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
