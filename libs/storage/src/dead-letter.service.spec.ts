import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { DeadLetterService } from './dead-letter.service.js';
import { StorageService } from './storage.service.js';
describe('DeadLetterService', () => {
  let service: DeadLetterService;
  let storage: {
    appendDeadLetterRecordId: ReturnType<typeof vi.fn>;
    appendDeadLetterPayload: ReturnType<typeof vi.fn>;
  };
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    storage = {
      appendDeadLetterRecordId: vi
        .fn()
        .mockResolvedValue('runs/run-1/dlq/scrape.record.detail.txt'),
      appendDeadLetterPayload: vi
        .fn()
        .mockResolvedValue('runs/run-1/dlq/scrape.listing.init.jsonl'),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterService,
        { provide: StorageService, useValue: storage },
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
  it('returns without writing a dead letter when the handler succeeds', async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    await service.run(
      'scrape.record.detail',
      { runId: 'run-1', recordId: '1' },
      { recordId: '1' },
      handle,
    );
    expect(handle).toHaveBeenCalledTimes(1);
    expect(storage.appendDeadLetterRecordId).not.toHaveBeenCalled();
    expect(storage.appendDeadLetterPayload).not.toHaveBeenCalled();
  });
  it('retries a failing handler up to the configured max attempts before succeeding', async () => {
    const handle = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);
    await service.run(
      'scrape.record.detail',
      { runId: 'run-1', recordId: '1' },
      { recordId: '1' },
      handle,
    );
    expect(handle).toHaveBeenCalledTimes(2);
    expect(storage.appendDeadLetterRecordId).not.toHaveBeenCalled();
    expect(storage.appendDeadLetterPayload).not.toHaveBeenCalled();
  });
  it('appends only the record id once retries are exhausted for a record-scoped target', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('boom'));
    await service.run(
      'scrape.record.detail',
      { runId: 'run-1', recordId: '1' },
      { recordId: '1', scheduledAt: 'now' },
      handle,
    );
    expect(handle).toHaveBeenCalledTimes(3);
    expect(storage.appendDeadLetterRecordId).toHaveBeenCalledWith(
      'run-1',
      'scrape.record.detail',
      '1',
    );
    expect(storage.appendDeadLetterPayload).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('runs/run-1/dlq/scrape.record.detail.txt'),
    );
  });
  it('appends the payload, attempts and error once retries are exhausted for a run-scoped target', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('boom'));
    const payload = { runId: 'run-1', baseUrl: 'https://example.com' };
    await service.run(
      'scrape.listing.init',
      { runId: 'run-1' },
      payload,
      handle,
    );
    expect(handle).toHaveBeenCalledTimes(3);
    expect(storage.appendDeadLetterRecordId).not.toHaveBeenCalled();
    expect(storage.appendDeadLetterPayload).toHaveBeenCalledTimes(1);
    const [runId, topic, entry] = storage.appendDeadLetterPayload.mock
      .calls[0] as [string, string, Record<string, unknown>];
    expect(runId).toBe('run-1');
    expect(topic).toBe('scrape.listing.init');
    expect(entry).toMatchObject({
      payload,
      attempts: 3,
      error: { message: 'boom' },
    });
    expect(typeof (entry.error as Record<string, unknown>).stack).toBe(
      'string',
    );
    expect(typeof entry.failedAt).toBe('string');
  });
  it('records a string message and no stack when the handler rejects with a non-Error value', async () => {
    const handle = vi.fn().mockRejectedValue('nope');
    await service.run('scrape.listing.init', { runId: 'run-1' }, {}, handle);
    const [, , entry] = storage.appendDeadLetterPayload.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(entry).toMatchObject({ error: { message: 'nope' } });
    expect((entry.error as Record<string, unknown>).stack).toBeUndefined();
  });
});
