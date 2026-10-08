import { Test, TestingModule } from '@nestjs/testing';
import { HandlerRetryService } from '@app/storage';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
import { DetailController } from './detail.controller.js';
describe('DetailController', () => {
  let handlerRetry: {
    runOrDeadLetter: ReturnType<typeof vi.fn>;
  };
  let detailController: DetailController;
  let detailScraper: {
    handle: ReturnType<typeof vi.fn>;
  };
  let expiredReprocess: {
    run: ReturnType<typeof vi.fn>;
  };
  let xxReprocess: {
    run: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    handlerRetry = {
      runOrDeadLetter: vi.fn(
        (
          _topic: string,
          _target: unknown,
          _payload: unknown,
          handle: () => Promise<void>,
        ) => handle(),
      ),
    };
    detailScraper = { handle: vi.fn().mockResolvedValue(undefined) };
    expiredReprocess = {
      run: vi.fn().mockResolvedValue({ reprocessed: ['1', '2'] }),
    };
    xxReprocess = {
      run: vi.fn().mockResolvedValue({ reprocessed: ['3', '4'] }),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DetailController],
      providers: [
        { provide: DetailScraperService, useValue: detailScraper },
        { provide: ExpiredReprocessService, useValue: expiredReprocess },
        { provide: XxReprocessService, useValue: xxReprocess },
        { provide: HandlerRetryService, useValue: handlerRetry },
      ],
    }).compile();
    detailController = app.get<DetailController>(DetailController);
  });
  describe('handleRecordDetail', () => {
    it('delegates to DetailScraperService', async () => {
      const message = {
        recordId: '123',
        detailMode: 'logged-out' as const,
        scheduledAt: '2026-01-01T00:00:00.000Z',
      };
      await detailController.handleRecordDetail(message);
      expect(detailScraper.handle).toHaveBeenCalledWith(message);
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.record.detail',
        { runId: 'manual', recordId: '123' },
        message,
        expect.any(Function),
      );
    });
    it('dead-letters under the message runId when present', async () => {
      const message = {
        recordId: '123',
        detailMode: 'logged-out' as const,
        scheduledAt: '2026-01-01T00:00:00.000Z',
        runId: 'run-9',
      };
      await detailController.handleRecordDetail(message);
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.record.detail',
        { runId: 'run-9', recordId: '123' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleExpiredReprocess', () => {
    it('delegates to ExpiredReprocessService', async () => {
      const message = { runId: 'run-3', detailMode: 'logged-in' as const };
      await detailController.handleExpiredReprocess(message);
      expect(expiredReprocess.run).toHaveBeenCalledWith('run-3', 'logged-in');
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.records.expired.reprocess',
        { runId: 'run-3' },
        message,
        expect.any(Function),
      );
    });
  });
  describe('handleXxReprocess', () => {
    it('delegates to XxReprocessService', async () => {
      const message = { runId: 'run-3b', detailMode: 'logged-out' as const };
      await detailController.handleXxReprocess(message);
      expect(xxReprocess.run).toHaveBeenCalledWith('run-3b', 'logged-out');
      expect(handlerRetry.runOrDeadLetter).toHaveBeenCalledWith(
        'scrape.records.xx.reprocess',
        { runId: 'run-3b' },
        message,
        expect.any(Function),
      );
    });
  });
});
