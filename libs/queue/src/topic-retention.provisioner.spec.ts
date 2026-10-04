const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockCreateTopics = vi.fn().mockResolvedValue(undefined);
const mockAdmin = vi.fn(() => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
  createTopics: mockCreateTopics,
}));
const MockKafka = vi.fn(function MockKafka(this: { admin: typeof mockAdmin }) {
  this.admin = mockAdmin;
});
vi.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: { Kafka: MockKafka, logLevel: { NOTHING: 0 } },
}));
const { provisionTopicRetention } =
  await import('./topic-retention.provisioner.js');
const { ALL_TOPICS } = await import('./topics.js');
describe('provisionTopicRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('connects, creates every topic with the configured retention, and disconnects', async () => {
    await provisionTopicRetention(['broker:9092'], 3600000);
    expect(MockKafka).toHaveBeenCalledWith({
      kafkaJS: { brokers: ['broker:9092'], logLevel: 0 },
    });
    expect(mockConnect).toHaveBeenCalledTimes(1);
    const [{ topics }] = mockCreateTopics.mock.calls[0] as [
      {
        topics: {
          topic: string;
          configEntries: { name: string; value: string }[];
        }[];
      },
    ];
    expect(topics.map((t) => t.topic)).toEqual([...ALL_TOPICS]);
    for (const { configEntries } of topics) {
      expect(configEntries).toEqual([
        { name: 'retention.ms', value: '3600000' },
      ]);
    }
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
  it('disconnects even when createTopics throws', async () => {
    mockCreateTopics.mockRejectedValueOnce(new Error('boom'));
    await expect(
      provisionTopicRetention(['broker:9092'], 3600000),
    ).rejects.toThrow('boom');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
