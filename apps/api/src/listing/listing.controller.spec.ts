import { Test, TestingModule } from '@nestjs/testing';
import { ListingController } from './listing.controller.js';
import { ListingService } from './listing.service.js';
describe('ListingController', () => {
  let controller: ListingController;
  let listingService: {
    initListing: ReturnType<typeof vi.fn>;
    reprocessPendingRecords: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    listingService = {
      initListing: vi.fn().mockResolvedValue({
        runId: 'run-1',
        status: 'queued',
      }),
      reprocessPendingRecords: vi.fn().mockResolvedValue({
        runId: 'run-2',
        fromRunId: '11111111-1111-4111-8111-111111111111',
        status: 'queued',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingController],
      providers: [{ provide: ListingService, useValue: listingService }],
    }).compile();
    controller = module.get<ListingController>(ListingController);
  });
  it('delegates listing init to the service and returns its result', async () => {
    const dto = { baseUrl: 'https://example.com' };
    const result = await controller.initListing(dto);
    expect(listingService.initListing).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-1', status: 'queued' });
  });
  it('delegates pending reprocess to the service and returns its result', async () => {
    const fromRunId = '11111111-1111-4111-8111-111111111111';
    const dto = { recycle: true };
    const result = await controller.reprocessPendingRecords(fromRunId, dto);
    expect(listingService.reprocessPendingRecords).toHaveBeenCalledWith(
      fromRunId,
      dto,
    );
    expect(result).toEqual({
      runId: 'run-2',
      fromRunId,
      status: 'queued',
    });
  });
});
