import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@app/storage';
import { PendingReprocessService } from './pending-reprocess.service.js';
import { ListingDispatchService } from './listing-dispatch.service.js';
describe('PendingReprocessService', () => {
  let storage: {
    readRawListingIds: ReturnType<typeof vi.fn>;
  };
  let dispatch: {
    dispatch: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<PendingReprocessService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PendingReprocessService,
        { provide: StorageService, useValue: storage },
        { provide: ListingDispatchService, useValue: dispatch },
      ],
    }).compile();
    return module.get<PendingReprocessService>(PendingReprocessService);
  }
  beforeEach(() => {
    storage = {
      readRawListingIds: vi.fn().mockResolvedValue(['1', '2', '2']),
    };
    dispatch = {
      dispatch: vi.fn().mockResolvedValue({
        dispatched: ['1', '2'],
        skipped: [],
      }),
    };
  });
  it("reads the fromRunId's raw listing ids and hands them to dispatch under the new runId", async () => {
    const service = await buildService();
    const result = await service.run('run-2', 'run-1');
    expect(storage.readRawListingIds).toHaveBeenCalledWith('run-1');
    expect(dispatch.dispatch).toHaveBeenCalledWith('run-2', ['1', '2', '2']);
    expect(result).toEqual({ dispatched: ['1', '2'], skipped: [] });
  });
});
