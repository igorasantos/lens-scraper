import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { QUEUE_PORT } from './queue-port.token.js';
import { DeadLetterService } from './dead-letter.service.js';
describe('DeadLetterService', () => {
  let service: DeadLetterService;
  let queuePort: { publish: ReturnType<typeof vi.fn> };
  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queuePort = { publish: vi.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterService,
        { provide: QUEUE_PORT, useValue: queuePort },
        {
          provide: ConfigService,
          useValue: { kafkaHandlerMaxAttempts: 3, kafkaHandlerRetryBaseMs: 1 },
        },
      ],
    }).compile();
    service = module.get<DeadLetterService>(DeadLetterService);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('returns without publishing to the dead-letter topic when the handler succeeds', async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    await service.run('scrape.record.detail', { recordId: '1' }, handle);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
  it('retries a failing handler up to the configured max attempts before succeeding', async () => {
    const handle = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);
    await service.run('scrape.record.detail', { recordId: '1' }, handle);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
  it('publishes to the dead-letter topic once retries are exhausted', async () => {
    const error = new Error('boom');
    const handle = vi.fn().mockRejectedValue(error);
    const payload = { recordId: '1' };
    await service.run('scrape.record.detail', payload, handle);
    expect(handle).toHaveBeenCalledTimes(3);
    expect(queuePort.publish).toHaveBeenCalledTimes(1);
    const [topic, envelope] = queuePort.publish.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(topic).toBe('scrape.record.detail.dlq');
    expect(envelope).toMatchObject({
      topic: 'scrape.record.detail',
      payload,
      attempts: 3,
      error: { message: 'boom' },
    });
    expect(typeof envelope.failedAt).toBe('string');
  });
  it('records a string message and no stack when the handler rejects with a non-Error value', async () => {
    const handle = vi.fn().mockRejectedValue('nope');
    await service.run('scrape.record.detail', { recordId: '1' }, handle);
    const [, envelope] = queuePort.publish.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(envelope).toMatchObject({ error: { message: 'nope' } });
    expect((envelope.error as Record<string, unknown>).stack).toBeUndefined();
  });
});
