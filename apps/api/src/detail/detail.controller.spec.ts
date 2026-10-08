import { Test, TestingModule } from '@nestjs/testing';
import { DetailController } from './detail.controller.js';
import { DetailService } from './detail.service.js';
describe('DetailController', () => {
  let controller: DetailController;
  let detailService: {
    queueRecordDetails: ReturnType<typeof vi.fn>;
    reprocessExpiredRecords: ReturnType<typeof vi.fn>;
    reprocessXxRecords: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    detailService = {
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
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetailController],
      providers: [{ provide: DetailService, useValue: detailService }],
    }).compile();
    controller = module.get<DetailController>(DetailController);
  });
  it('delegates record details queueing to the service and returns its result', async () => {
    const dto = {
      detail_mode: 'logged-out' as const,
      records_to_reprocess: ['123'],
    };
    const result = await controller.queueRecordDetails(dto);
    expect(detailService.queueRecordDetails).toHaveBeenCalledWith(dto);
    expect(result).toEqual([
      {
        recordId: '123',
        status: 'queued',
        scheduledAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
  it('delegates expired records reprocessing to the service and returns its result', async () => {
    const dto = { detail_mode: 'logged-in' as const };
    const result = await controller.reprocessExpiredRecords(dto);
    expect(detailService.reprocessExpiredRecords).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-3', status: 'queued' });
  });
  it('delegates xx records reprocessing to the service and returns its result', async () => {
    const dto = { detail_mode: 'logged-out' as const };
    const result = await controller.reprocessXxRecords(dto);
    expect(detailService.reprocessXxRecords).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-3b', status: 'queued' });
  });
});
