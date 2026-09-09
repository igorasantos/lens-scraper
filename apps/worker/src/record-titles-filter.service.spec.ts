import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@app/storage';
import { RecordTitlesFilterService } from './record-titles-filter.service.js';
describe('RecordTitlesFilterService', () => {
  let storage: {
    readDedupSortedRecordTitles: ReturnType<typeof vi.fn>;
    writeFilteredRecordTitles: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordTitlesFilterService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordTitlesFilterService,
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<RecordTitlesFilterService>(RecordTitlesFilterService);
  }
  beforeEach(() => {
    storage = {
      readDedupSortedRecordTitles: vi.fn().mockResolvedValue([]),
      writeFilteredRecordTitles: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('writes an empty file when there are no titles', async () => {
    const service = await buildService();
    const result = await service.run('run-1', ['something scraped']);
    expect(result).toEqual({ titleCount: 0 });
    expect(storage.writeFilteredRecordTitles).toHaveBeenCalledWith([]);
  });
  it('drops titles containing any of the given substrings, case-insensitively', async () => {
    storage.readDedupSortedRecordTitles.mockResolvedValue([
      'Something Scraped',
      'Near Nothing',
      'Almost some',
    ]);
    const service = await buildService();
    const result = await service.run('run-1', ['SOMETHING', 'nothing']);
    expect(result).toEqual({ titleCount: 1 });
    expect(storage.writeFilteredRecordTitles).toHaveBeenCalledWith([
      'Almost some',
    ]);
  });
  it('keeps every title when no substring matches', async () => {
    storage.readDedupSortedRecordTitles.mockResolvedValue([
      'Something Scraped',
    ]);
    const service = await buildService();
    const result = await service.run('run-1', ['recruiter']);
    expect(result).toEqual({ titleCount: 1 });
    expect(storage.writeFilteredRecordTitles).toHaveBeenCalledWith([
      'Something Scraped',
    ]);
  });
});
