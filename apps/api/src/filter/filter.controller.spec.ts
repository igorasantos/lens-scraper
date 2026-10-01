import { Test, TestingModule } from '@nestjs/testing';
import { FilterController } from './filter.controller.js';
import { FilterService } from './filter.service.js';
describe('FilterController', () => {
  let controller: FilterController;
  let filterService: {
    filterRecords: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    filterService = {
      filterRecords: vi.fn().mockResolvedValue({
        runId: 'run-7',
        status: 'queued',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilterController],
      providers: [{ provide: FilterService, useValue: filterService }],
    }).compile();
    controller = module.get<FilterController>(FilterController);
  });
  it('delegates record filtering to the service and returns its result', async () => {
    const result = await controller.filterRecords();
    expect(filterService.filterRecords).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-7', status: 'queued' });
  });
});
