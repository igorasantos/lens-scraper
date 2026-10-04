import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'playwright';
import { BrowserService } from '@app/browser';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { LOCK_PORT, SESSION_LOCK_KEY } from '@app/redis-lock';
import { ConfigService } from '@app/config';
import { QueueService } from '@app/queue';
import { DetailScraperService } from './detail-scraper.service.js';
describe('DetailScraperService', () => {
  const pastScheduledAt = new Date(Date.now() - 1000).toISOString();
  let page: {
    goto: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    mainFrame: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  function triggerFrameNavigated(url: string): void {
    const frame = { url: () => url };
    page.mainFrame.mockReturnValue(frame);
    const handler = page.on.mock.calls.find(
      ([event]: [string, unknown]) => event === 'framenavigated',
    )?.[1] as ((frame: { url: () => string }) => void) | undefined;
    handler?.(frame);
  }
  let browser: {
    newPage: ReturnType<typeof vi.fn>;
    goto: ReturnType<typeof vi.fn>;
    scrollRandomly: ReturnType<typeof vi.fn>;
    closePage: ReturnType<typeof vi.fn>;
  };
  let site: {
    buildRecordDetailUrl: ReturnType<typeof vi.fn>;
    isRecordDetailUrl: ReturnType<typeof vi.fn>;
    extractRecordDetail: ReturnType<typeof vi.fn>;
  };
  let storage: {
    writeRecordDetail: ReturnType<typeof vi.fn>;
    writeExpiredRecordDetail: ReturnType<typeof vi.fn>;
    appendRecordId: ReturnType<typeof vi.fn>;
    appendSourceName: ReturnType<typeof vi.fn>;
    writeSourceDetail: ReturnType<typeof vi.fn>;
    appendFailure: ReturnType<typeof vi.fn>;
    appendExpiredRecord: ReturnType<typeof vi.fn>;
    removeExpiredRecord: ReturnType<typeof vi.fn>;
    migrateOutOfUnknownLanguageBucket: ReturnType<typeof vi.fn>;
  };
  let lock: {
    acquire: ReturnType<typeof vi.fn>;
    extend: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let config: {
    maxExtractionAttempts: number;
    fixedWaitMs: number;
    lockTtlMs: number;
    recordDetailWaitMinSec: number;
    recordDetailWaitMaxSec: number;
  };
  let queue: {
    publishRecordDetail: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<DetailScraperService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailScraperService,
        { provide: BrowserService, useValue: browser },
        { provide: SiteService, useValue: site },
        { provide: StorageService, useValue: storage },
        { provide: LOCK_PORT, useValue: lock },
        { provide: ConfigService, useValue: config },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    return module.get<DetailScraperService>(DetailScraperService);
  }
  beforeEach(() => {
    page = {
      goto: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      mainFrame: vi.fn().mockReturnValue({
        url: () => 'https://www.site.com/123',
      }),
      on: vi.fn(),
      off: vi.fn(),
    };
    browser = {
      newPage: vi.fn().mockResolvedValue(page as unknown as Page),
      goto: vi.fn((p: { goto: (url: string) => Promise<void> }, url: string) =>
        p.goto(url),
      ),
      scrollRandomly: vi.fn().mockResolvedValue(undefined),
      closePage: vi.fn((p: { close: () => Promise<void> }) => p.close()),
    };
    site = {
      scrollFocusSelector: '#app',
      buildRecordDetailUrl: vi.fn(
        (recordId: string) => `https://www.site.com/${recordId}`,
      ),
      isRecordDetailUrl: vi.fn().mockReturnValue(true),
      extractRecordDetail: vi.fn(),
    };
    storage = {
      writeRecordDetail: vi.fn().mockResolvedValue(undefined),
      writeExpiredRecordDetail: vi.fn().mockResolvedValue(undefined),
      appendRecordId: vi.fn().mockResolvedValue(undefined),
      appendSourceName: vi.fn().mockResolvedValue(true),
      writeSourceDetail: vi.fn().mockResolvedValue(undefined),
      appendFailure: vi.fn().mockResolvedValue(undefined),
      appendExpiredRecord: vi.fn().mockResolvedValue(undefined),
      removeExpiredRecord: vi.fn().mockResolvedValue(false),
      migrateOutOfUnknownLanguageBucket: vi.fn().mockResolvedValue(undefined),
    };
    lock = {
      acquire: vi.fn().mockResolvedValue('token-1'),
      extend: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(true),
    };
    config = {
      maxExtractionAttempts: 3,
      fixedWaitMs: 0,
      lockTtlMs: 90000,
      recordDetailWaitMinSec: 0,
      recordDetailWaitMaxSec: 0,
    };
    queue = {
      publishRecordDetail: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('acquires the session lock, extracts on the first successful attempt, persists under the guessed language, and releases the lock', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      bodyContentText:
        'Our platform focuses on distributed systems and scalable APIs, with new capabilities rolling out this quarter.',
      sourceName: 'source-alpha',
      sourceHtml: '<div>about source</div>',
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(lock.acquire).toHaveBeenCalledWith(SESSION_LOCK_KEY, 90000);
    expect(page.goto).toHaveBeenCalledWith('https://www.site.com/123');
    expect(site.extractRecordDetail).toHaveBeenCalledTimes(1);
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'en',
      '123',
      '<div>ok</div>',
    );
    expect(storage.appendSourceName).toHaveBeenCalledWith('source-alpha');
    expect(storage.writeSourceDetail).toHaveBeenCalledWith(
      'source-alpha',
      '<div>about source</div>',
    );
    expect(storage.appendRecordId).toHaveBeenCalledWith('123', 'en');
    expect(storage.removeExpiredRecord).toHaveBeenCalledWith('123');
    expect(storage.migrateOutOfUnknownLanguageBucket).toHaveBeenCalledWith(
      '123',
    );
    expect(storage.appendFailure).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    expect(page.close).toHaveBeenCalledTimes(1);
  });
  it('drops a previously-expired record from records_expired.txt once it is re-scraped as no longer expired', async () => {
    storage.removeExpiredRecord.mockResolvedValue(true);
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>republished</div>',
      bodyContentText:
        'Our platform focuses on distributed systems and scalable APIs, with new capabilities rolling out this quarter.',
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-2',
    });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'en',
      '123',
      '<div>republished</div>',
    );
    expect(storage.removeExpiredRecord).toHaveBeenCalledWith('123');
    expect(storage.writeExpiredRecordDetail).not.toHaveBeenCalled();
    expect(storage.appendExpiredRecord).not.toHaveBeenCalled();
  });
  it('migrates a previously records_xx.txt record out of the xx bucket once a real language is determined (POST /scrape/records/xx/reprocess)', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>reprocessed</div>',
      bodyContentText:
        'Our platform focuses on distributed systems and scalable APIs, with new capabilities rolling out this quarter.',
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-3',
    });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'en',
      '123',
      '<div>reprocessed</div>',
    );
    expect(storage.migrateOutOfUnknownLanguageBucket).toHaveBeenCalledWith(
      '123',
    );
  });
  it('does not touch records_expired.txt when persisting a still-expired record', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>still expired</div>',
      sourceName: null,
      sourceHtml: null,
      isExpired: true,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.removeExpiredRecord).not.toHaveBeenCalled();
  });
  it('writes record detail HTML under records_expired/ instead of records/ and records the record as expired when isExpired is true', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      sourceName: 'source-alpha',
      sourceHtml: '<div>about source</div>',
      isExpired: true,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.writeExpiredRecordDetail).toHaveBeenCalledWith(
      '123',
      '<div>ok</div>',
    );
    expect(storage.appendExpiredRecord).toHaveBeenCalledWith('123');
    expect(storage.writeRecordDetail).not.toHaveBeenCalled();
    expect(storage.appendSourceName).toHaveBeenCalledWith('source-alpha');
    expect(storage.writeSourceDetail).toHaveBeenCalledWith(
      'source-alpha',
      '<div>about source</div>',
    );
    expect(storage.appendRecordId).toHaveBeenCalledWith('123', 'xx');
    expect(storage.migrateOutOfUnknownLanguageBucket).toHaveBeenCalledWith(
      '123',
    );
  });
  it('does not append a source name when extraction found none', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      sourceName: null,
      sourceHtml: null,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.appendSourceName).not.toHaveBeenCalled();
    expect(storage.writeSourceDetail).not.toHaveBeenCalled();
  });
  it('does not write the source detail page when the source name was already recorded', async () => {
    storage.appendSourceName.mockResolvedValue(false);
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      sourceName: 'source-alpha',
      sourceHtml: '<div>about source</div>',
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.appendSourceName).toHaveBeenCalledWith('source-alpha');
    expect(storage.writeSourceDetail).not.toHaveBeenCalled();
  });
  it('does not append the source name or write the source detail page when there is no source content', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      sourceName: 'source-alpha',
      sourceHtml: null,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.appendSourceName).not.toHaveBeenCalled();
    expect(storage.writeSourceDetail).not.toHaveBeenCalled();
  });
  it('retries a whole attempt (not just the read) up to maxExtractionAttempts, then writes the last attempt with a failure record', async () => {
    site.extractRecordDetail
      .mockResolvedValueOnce({
        sectionFound: true,
        hasBodyContent: false,
        html: '<div>1</div>',
        sourceName: null,
        sourceHtml: null,
      })
      .mockResolvedValueOnce({
        sectionFound: true,
        hasBodyContent: false,
        html: '<div>2</div>',
        sourceName: null,
        sourceHtml: null,
      })
      .mockResolvedValueOnce({
        sectionFound: true,
        hasBodyContent: false,
        html: '<div>3</div>',
        sourceName: null,
        sourceHtml: null,
      });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(site.extractRecordDetail).toHaveBeenCalledTimes(3);
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'xx',
      '123',
      '<div>3</div>',
    );
    expect(storage.appendFailure).toHaveBeenCalledWith('run-1', {
      recordId: '123',
      reason: 'body-content-incomplete',
      attempts: 3,
    });
    expect(storage.migrateOutOfUnknownLanguageBucket).not.toHaveBeenCalled();
  });
  it('renews the session lock on every extraction attempt', async () => {
    site.extractRecordDetail
      .mockResolvedValueOnce({
        sectionFound: true,
        hasBodyContent: false,
        html: '<div>1</div>',
        sourceName: null,
        sourceHtml: null,
      })
      .mockResolvedValueOnce({
        sectionFound: true,
        hasBodyContent: true,
        html: '<div>2</div>',
        sourceName: null,
        sourceHtml: null,
      });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(lock.extend).toHaveBeenCalledTimes(2);
    expect(lock.extend).toHaveBeenCalledWith(
      SESSION_LOCK_KEY,
      'token-1',
      90000,
    );
  });
  it('throws and releases the lock when it is lost mid-extraction', async () => {
    lock.extend.mockResolvedValue(false);
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: false,
      hasBodyContent: false,
      html: null,
      sourceName: null,
      sourceHtml: null,
    });
    const service = await buildService();
    await expect(
      service.handle({
        recordId: '123',
        scheduledAt: pastScheduledAt,
        runId: 'run-1',
      }),
    ).rejects.toThrow(/lost the site session lock/i);
    expect(site.extractRecordDetail).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    expect(page.close).toHaveBeenCalledTimes(1);
  });
  it('writes an error message and a missing-section failure record when the section never appears', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: false,
      hasBodyContent: false,
      html: null,
      sourceName: null,
      sourceHtml: null,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(site.extractRecordDetail).toHaveBeenCalledTimes(3);
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'xx',
      '123',
      expect.stringContaining('3 attempts'),
    );
    expect(storage.appendFailure).toHaveBeenCalledWith('run-1', {
      recordId: '123',
      reason: 'missing-section',
      attempts: 3,
    });
    expect(storage.migrateOutOfUnknownLanguageBucket).not.toHaveBeenCalled();
  });
  it('records the recordId under xx and a redirected failure, without retrying or writing HTML, when site redirects right after navigation', async () => {
    site.isRecordDetailUrl.mockReturnValue(false);
    page.goto.mockImplementation(async () => {
      triggerFrameNavigated('https://www.site.com/');
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(site.isRecordDetailUrl).toHaveBeenCalledWith(
      'https://www.site.com/',
      '123',
    );
    expect(browser.scrollRandomly).not.toHaveBeenCalled();
    expect(site.extractRecordDetail).not.toHaveBeenCalled();
    expect(storage.writeRecordDetail).not.toHaveBeenCalled();
    expect(storage.appendFailure).toHaveBeenCalledWith('run-1', {
      recordId: '123',
      reason: 'redirected',
      attempts: 0,
    });
    expect(storage.appendRecordId).toHaveBeenCalledWith('123', 'xx');
    expect(storage.migrateOutOfUnknownLanguageBucket).not.toHaveBeenCalled();
    expect(page.off).toHaveBeenCalledWith(
      'framenavigated',
      expect.any(Function),
    );
    expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
    expect(page.close).toHaveBeenCalledTimes(1);
  });
  it('stops retrying mid-extraction and treats it as a redirect when the frame navigates away asynchronously (not just right after goto)', async () => {
    site.isRecordDetailUrl.mockImplementation(
      (url: string) => url !== 'https://www.site.com/',
    );
    site.extractRecordDetail.mockImplementation(async () => {
      triggerFrameNavigated('https://www.site.com/');
      return {
        sectionFound: false,
        hasBodyContent: false,
        html: null,
        sourceName: null,
        sourceHtml: null,
      };
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(browser.scrollRandomly).toHaveBeenCalledTimes(1);
    expect(site.extractRecordDetail).toHaveBeenCalledTimes(1);
    expect(storage.writeRecordDetail).not.toHaveBeenCalled();
    expect(storage.appendFailure).toHaveBeenCalledWith('run-1', {
      recordId: '123',
      reason: 'redirected',
      attempts: 0,
    });
    expect(storage.appendRecordId).toHaveBeenCalledWith('123', 'xx');
    expect(storage.migrateOutOfUnknownLanguageBucket).not.toHaveBeenCalled();
  });
  it('breaks out of the retry loop before re-extracting when the frame redirects during a lock renewal', async () => {
    site.isRecordDetailUrl.mockImplementation(
      (url: string) => url !== 'https://www.site.com/',
    );
    lock.extend.mockImplementation(async () => {
      triggerFrameNavigated('https://www.site.com/');
      return true;
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(site.extractRecordDetail).not.toHaveBeenCalled();
    expect(storage.appendFailure).toHaveBeenCalledWith('run-1', {
      recordId: '123',
      reason: 'redirected',
      attempts: 0,
    });
    expect(storage.appendRecordId).toHaveBeenCalledWith('123', 'xx');
  });
  it('ignores a frame navigation event that lands back on the record detail url', async () => {
    site.extractRecordDetail.mockImplementation(async () => {
      triggerFrameNavigated('https://www.site.com/123');
      return {
        sectionFound: true,
        hasBodyContent: true,
        html: '<div>ok</div>',
        sourceName: null,
        sourceHtml: null,
        isExpired: false,
      };
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'xx',
      '123',
      '<div>ok</div>',
    );
    expect(storage.appendFailure).not.toHaveBeenCalled();
  });
  it('writes empty html for an expired record when extraction found no html', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: null,
      sourceName: null,
      sourceHtml: null,
      isExpired: true,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.writeExpiredRecordDetail).toHaveBeenCalledWith('123', '');
  });
  it('writes empty html for a non-expired record when extraction found no html', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: null,
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith('xx', '123', '');
  });
  it('defaults to the manual run id when the message carries none', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div/>',
      sourceName: null,
      sourceHtml: null,
    });
    const service = await buildService();
    await service.handle({ recordId: '123', scheduledAt: pastScheduledAt });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'xx',
      '123',
      '<div/>',
    );
  });
  it('waits a random delay within [recordDetailWaitMinSec, recordDetailWaitMaxSec], rolled from Date.now(), before acquiring the lock', async () => {
    config.recordDetailWaitMinSec = 2;
    config.recordDetailWaitMaxSec = 5;
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div/>',
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const service = await buildService();
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const done = service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    await vi.advanceTimersByTimeAsync(3499);
    expect(lock.acquire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    await done;
    expect(lock.acquire).toHaveBeenCalled();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('processes immediately even when scheduledAt is far in the future (no longer waited on)', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div/>',
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const futureScheduledAt = new Date(Date.now() + 60000).toISOString();
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: futureScheduledAt,
      runId: 'run-1',
    });
    expect(storage.writeRecordDetail).toHaveBeenCalledWith(
      'xx',
      '123',
      '<div/>',
    );
  });
  it('requeues the message without throwing or touching the browser when the session lock is already held', async () => {
    lock.acquire.mockResolvedValue(null);
    const service = await buildService();
    const message = {
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    };
    await expect(service.handle(message)).resolves.toBeUndefined();
    expect(queue.publishRecordDetail).toHaveBeenCalledWith(message);
    expect(browser.newPage).not.toHaveBeenCalled();
    expect(lock.release).not.toHaveBeenCalled();
    expect(storage.appendFailure).not.toHaveBeenCalled();
  });
  it('does not requeue when the session lock is acquired', async () => {
    site.extractRecordDetail.mockResolvedValue({
      sectionFound: true,
      hasBodyContent: true,
      html: '<div>ok</div>',
      bodyContentText: null,
      sourceName: null,
      sourceHtml: null,
      isExpired: false,
    });
    const service = await buildService();
    await service.handle({
      recordId: '123',
      scheduledAt: pastScheduledAt,
      runId: 'run-1',
    });
    expect(queue.publishRecordDetail).not.toHaveBeenCalled();
  });
  it('releases the lock and closes the page even if extraction throws', async () => {
    site.extractRecordDetail.mockRejectedValue(new Error('boom'));
    const service = await buildService();
    await expect(
      service.handle({
        recordId: '123',
        scheduledAt: pastScheduledAt,
        runId: 'run-1',
      }),
    ).rejects.toThrow('boom');
    expect(page.close).toHaveBeenCalledTimes(1);
    expect(lock.release).toHaveBeenCalledWith(SESSION_LOCK_KEY, 'token-1');
  });
});
