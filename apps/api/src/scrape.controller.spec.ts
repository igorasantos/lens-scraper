import { Test, TestingModule } from '@nestjs/testing';
import { ScrapeController } from './scrape.controller.js';
import { ScrapeService } from './scrape.service.js';
describe('ScrapeController', () => {
  let controller: ScrapeController;
  let scrapeService: {
    initListing: ReturnType<typeof vi.fn>;
    continueListing: ReturnType<typeof vi.fn>;
    queueRecordDetails: ReturnType<typeof vi.fn>;
    reprocessExpiredRecords: ReturnType<typeof vi.fn>;
    reprocessXxRecords: ReturnType<typeof vi.fn>;
    extractRecordTitles: ReturnType<typeof vi.fn>;
    dedupSortRecordTitles: ReturnType<typeof vi.fn>;
    filterRecordTitles: ReturnType<typeof vi.fn>;
    filterRecords: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    scrapeService = {
      initListing: vi.fn().mockResolvedValue({
        runId: 'run-1',
        status: 'queued',
      }),
      continueListing: vi.fn().mockResolvedValue({
        runId: 'run-2',
        fromRunId: '11111111-1111-4111-8111-111111111111',
        status: 'queued',
      }),
      queueRecordDetails: vi.fn().mockResolvedValue([
        {
          recordId: '123',
          status: 'queued',
          scheduledAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      reprocessExpiredRecords: vi.fn().mockResolvedValue({
        runId: 'run-3',
        status: 'queued',
      }),
      reprocessXxRecords: vi.fn().mockResolvedValue({
        runId: 'run-3b',
        status: 'queued',
      }),
      extractRecordTitles: vi.fn().mockResolvedValue({
        runId: 'run-4',
        status: 'queued',
      }),
      dedupSortRecordTitles: vi.fn().mockResolvedValue({
        runId: 'run-5',
        status: 'queued',
      }),
      filterRecordTitles: vi.fn().mockResolvedValue({
        runId: 'run-6',
        status: 'queued',
      }),
      filterRecords: vi.fn().mockResolvedValue({
        runId: 'run-7',
        status: 'queued',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapeController],
      providers: [{ provide: ScrapeService, useValue: scrapeService }],
    }).compile();
    controller = module.get<ScrapeController>(ScrapeController);
  });
  it('delegates listing init to the service and returns its result', async () => {
    const dto = { baseUrl: 'https://example.com' };
    const result = await controller.initListing(dto);
    expect(scrapeService.initListing).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-1', status: 'queued' });
  });
  it('delegates listing continue to the service and returns its result', async () => {
    const fromRunId = '11111111-1111-4111-8111-111111111111';
    const result = await controller.continueListing(fromRunId);
    expect(scrapeService.continueListing).toHaveBeenCalledWith(fromRunId);
    expect(result).toEqual({
      runId: 'run-2',
      fromRunId,
      status: 'queued',
    });
  });
  it('delegates record details queueing to the service and returns its result', async () => {
    const recordIds = ['123'];
    const result = await controller.queueRecordDetails(recordIds);
    expect(scrapeService.queueRecordDetails).toHaveBeenCalledWith(recordIds);
    expect(result).toEqual([
      {
        recordId: '123',
        status: 'queued',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
  it('delegates expired records reprocessing to the service and returns its result', async () => {
    const result = await controller.reprocessExpiredRecords();
    expect(scrapeService.reprocessExpiredRecords).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-3', status: 'queued' });
  });
  it('delegates xx records reprocessing to the service and returns its result', async () => {
    const result = await controller.reprocessXxRecords();
    expect(scrapeService.reprocessXxRecords).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-3b', status: 'queued' });
  });
  it('delegates record titles extraction to the service and returns its result', async () => {
    const result = await controller.extractRecordTitles();
    expect(scrapeService.extractRecordTitles).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-4', status: 'queued' });
  });
  it('delegates record titles dedup-sort to the service and returns its result', async () => {
    const result = await controller.dedupSortRecordTitles();
    expect(scrapeService.dedupSortRecordTitles).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-5', status: 'queued' });
  });
  it('delegates record titles filtering to the service and returns its result', async () => {
    const dto = { substrings: ['laptop', 'home'] };
    const result = await controller.filterRecordTitles(dto);
    expect(scrapeService.filterRecordTitles).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-6', status: 'queued' });
  });
  it('delegates record filtering to the service and returns its result', async () => {
    const result = await controller.filterRecords();
    expect(scrapeService.filterRecords).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-7', status: 'queued' });
  });
});
