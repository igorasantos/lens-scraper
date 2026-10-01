import { Test, TestingModule } from '@nestjs/testing';
import { TitlesController } from './titles.controller.js';
import { TitlesService } from './titles.service.js';
describe('TitlesController', () => {
  let controller: TitlesController;
  let titlesService: {
    extractRecordTitles: ReturnType<typeof vi.fn>;
    dedupSortRecordTitles: ReturnType<typeof vi.fn>;
    filterRecordTitles: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    titlesService = {
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
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TitlesController],
      providers: [{ provide: TitlesService, useValue: titlesService }],
    }).compile();
    controller = module.get<TitlesController>(TitlesController);
  });
  it('delegates record titles extraction to the service and returns its result', async () => {
    const result = await controller.extractRecordTitles();
    expect(titlesService.extractRecordTitles).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-4', status: 'queued' });
  });
  it('delegates record titles dedup-sort to the service and returns its result', async () => {
    const result = await controller.dedupSortRecordTitles();
    expect(titlesService.dedupSortRecordTitles).toHaveBeenCalledWith();
    expect(result).toEqual({ runId: 'run-5', status: 'queued' });
  });
  it('delegates record titles filtering to the service and returns its result', async () => {
    const dto = { substrings: ['laptop', 'home'] };
    const result = await controller.filterRecordTitles(dto);
    expect(titlesService.filterRecordTitles).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ runId: 'run-6', status: 'queued' });
  });
});
