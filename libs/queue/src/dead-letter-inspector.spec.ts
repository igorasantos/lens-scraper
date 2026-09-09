type EachMessageHandler = (arg: {
  message: { value: Buffer | null };
}) => Promise<void>;
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
let eachMessageHandler: EachMessageHandler | undefined;
let runImpl: () => Promise<void>;
const mockRun = vi.fn((opts: { eachMessage: EachMessageHandler }) => {
  eachMessageHandler = opts.eachMessage;
  return runImpl();
});
const mockConsumer = vi.fn(() => ({
  connect: mockConnect,
  subscribe: mockSubscribe,
  run: mockRun,
  disconnect: mockDisconnect,
}));
const MockKafka = vi.fn(function MockKafka(this: {
  consumer: typeof mockConsumer;
}) {
  this.consumer = mockConsumer;
});
vi.mock('@confluentinc/kafka-javascript', () => ({
  KafkaJS: { Kafka: MockKafka, logLevel: { NOTHING: 0 } },
}));
const { peekDeadLetterMessages } = await import('./dead-letter-inspector.js');
function message(value: unknown): { message: { value: Buffer } } {
  return { message: { value: Buffer.from(JSON.stringify(value)) } };
}
describe('peekDeadLetterMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eachMessageHandler = undefined;
    runImpl = () => new Promise(() => undefined);
  });
  it('connects, subscribes from the beginning, and disconnects once the limit is reached', async () => {
    const promise = peekDeadLetterMessages(
      ['broker:9092'],
      'scrape.record.detail.dlq',
      2,
      5000,
    );
    await vi.waitFor(() => expect(eachMessageHandler).toBeDefined());
    await eachMessageHandler!(message({ a: 1 }));
    await eachMessageHandler!(message({ a: 2 }));
    await expect(promise).resolves.toEqual([{ a: 1 }, { a: 2 }]);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith({
      topic: 'scrape.record.detail.dlq',
      fromBeginning: true,
    });
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
  it('ignores a second limit-reached message once already settled (finish() is idempotent)', async () => {
    const promise = peekDeadLetterMessages(
      ['broker:9092'],
      'scrape.record.detail.dlq',
      1,
      5000,
    );
    await vi.waitFor(() => expect(eachMessageHandler).toBeDefined());
    await eachMessageHandler!(message({ a: 1 }));
    await eachMessageHandler!(message({ a: 2 }));
    await expect(promise).resolves.toEqual([{ a: 1 }, { a: 2 }]);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
  it('ignores messages with no value', async () => {
    const promise = peekDeadLetterMessages(
      ['broker:9092'],
      'scrape.record.detail.dlq',
      1,
      5000,
    );
    await vi.waitFor(() => expect(eachMessageHandler).toBeDefined());
    await eachMessageHandler!({ message: { value: null } });
    await eachMessageHandler!(message({ a: 1 }));
    await expect(promise).resolves.toEqual([{ a: 1 }]);
  });
  it('resolves with whatever was collected once the timeout elapses before the limit is reached', async () => {
    vi.useFakeTimers();
    const promise = peekDeadLetterMessages(
      ['broker:9092'],
      'scrape.record.detail.dlq',
      5,
      50,
    );
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toEqual([]);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('finishes and disconnects when consumer.run rejects', async () => {
    runImpl = () => Promise.reject(new Error('run failed'));
    const promise = peekDeadLetterMessages(
      ['broker:9092'],
      'scrape.record.detail.dlq',
      5,
      5000,
    );
    await expect(promise).resolves.toEqual([]);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
