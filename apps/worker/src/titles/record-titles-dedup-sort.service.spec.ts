import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@app/storage';
import { RecordTitlesDedupSortService } from './record-titles-dedup-sort.service.js';
describe('RecordTitlesDedupSortService', () => {
  let storage: {
    readRawRecordTitles: ReturnType<typeof vi.fn>;
    writeDedupSortedRecordTitles: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordTitlesDedupSortService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordTitlesDedupSortService,
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<RecordTitlesDedupSortService>(
      RecordTitlesDedupSortService,
    );
  }
  beforeEach(() => {
    storage = {
      readRawRecordTitles: vi.fn().mockResolvedValue([]),
      writeDedupSortedRecordTitles: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('writes an empty file when there are no raw titles', async () => {
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ titleCount: 0 });
    expect(storage.writeDedupSortedRecordTitles).toHaveBeenCalledWith([]);
  });
  it('dedupes and alphabetically sorts the raw titles', async () => {
    storage.readRawRecordTitles.mockResolvedValue([
      'Widget Alpha',
      'Widget Beta',
      'Widget Alpha',
      'Widget Gamma',
    ]);
    const service = await buildService();
    const result = await service.run('run-1');
    expect(result).toEqual({ titleCount: 3 });
    expect(storage.writeDedupSortedRecordTitles).toHaveBeenCalledWith([
      'Widget Alpha',
      'Widget Beta',
      'Widget Gamma',
    ]);
  });
});
