import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@app/config';
import { DeadLetterService, QUEUE_PORT } from '@app/queue';
import { DetailScraperService } from './detail-scraper.service.js';
import { ExpiredReprocessService } from './expired-reprocess.service.js';
import { XxReprocessService } from './xx-reprocess.service.js';
import { DetailController } from './detail.controller.js';
describe('DetailController', () => {
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
        DeadLetterService,
        { provide: QUEUE_PORT, useValue: { publish: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { kafkaHandlerMaxAttempts: 3, kafkaHandlerRetryBaseMs: 1 },
        },
      ],
    }).compile();
    detailController = app.get<DetailController>(DetailController);
  });
  describe('handleRecordDetail', () => {
    it('delegates to DetailScraperService', async () => {
      const message = {
        recordId: '123',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      };
      await detailController.handleRecordDetail(message);
      expect(detailScraper.handle).toHaveBeenCalledWith(message);
    });
  });
  describe('handleExpiredReprocess', () => {
    it('delegates to ExpiredReprocessService', async () => {
      const message = { runId: 'run-3' };
      await detailController.handleExpiredReprocess(message);
      expect(expiredReprocess.run).toHaveBeenCalledWith('run-3');
    });
  });
  describe('handleXxReprocess', () => {
    it('delegates to XxReprocessService', async () => {
      const message = { runId: 'run-3b' };
      await detailController.handleXxReprocess(message);
      expect(xxReprocess.run).toHaveBeenCalledWith('run-3b');
    });
  });
});
