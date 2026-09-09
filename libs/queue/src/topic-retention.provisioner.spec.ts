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
const { ALL_TOPICS, ALL_DEAD_LETTER_TOPICS } = await import('./topics.js');
describe('provisionTopicRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('connects, creates every topic (including dead-letter topics) with the right retention, and disconnects', async () => {
    await provisionTopicRetention(['broker:9092'], 3600000, 604800000);
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
    expect(topics).toHaveLength(
      ALL_TOPICS.length + ALL_DEAD_LETTER_TOPICS.length,
    );
    const normalTopicConfig = topics.find((t) => t.topic === ALL_TOPICS[0]);
    expect(normalTopicConfig?.configEntries).toEqual([
      { name: 'retention.ms', value: '3600000' },
    ]);
    const dlqTopicConfig = topics.find(
      (t) => t.topic === ALL_DEAD_LETTER_TOPICS[0],
    );
    expect(dlqTopicConfig?.configEntries).toEqual([
      { name: 'retention.ms', value: '604800000' },
    ]);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
  it('disconnects even when createTopics throws', async () => {
    mockCreateTopics.mockRejectedValueOnce(new Error('boom'));
    await expect(
      provisionTopicRetention(['broker:9092'], 3600000, 604800000),
    ).rejects.toThrow('boom');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
