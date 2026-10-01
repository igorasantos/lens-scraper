import { Test, TestingModule } from '@nestjs/testing';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { RecordFilterCopyService } from './record-filter-copy.service.js';
describe('RecordFilterCopyService', () => {
  let site: {
    extractRecordTitleFromHtml: ReturnType<typeof vi.fn>;
  };
  let storage: {
    read: ReturnType<typeof vi.fn>;
    readFilteredRecordTitles: ReturnType<typeof vi.fn>;
    copyRecordDetailToFiltered: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordFilterCopyService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordFilterCopyService,
        { provide: SiteService, useValue: site },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<RecordFilterCopyService>(RecordFilterCopyService);
  }
  beforeEach(() => {
    site = { extractRecordTitleFromHtml: vi.fn() };
    storage = {
      read: vi.fn().mockResolvedValue('<div>111</div>'),
      readFilteredRecordTitles: vi.fn().mockResolvedValue(new Set()),
      copyRecordDetailToFiltered: vi
        .fn()
        .mockResolvedValue('3_records_filtered/en/111.html'),
    };
  });
  it('copies the file when its title is in the filtered set, using the parent dir as bucket', async () => {
    site.extractRecordTitleFromHtml.mockReturnValue('Widget Alpha');
    storage.readFilteredRecordTitles.mockResolvedValue(
      new Set(['Widget Alpha']),
    );
    const service = await buildService();
    await service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' });
    expect(storage.read).toHaveBeenCalledWith('1_records_raw/en/111.html');
    expect(storage.copyRecordDetailToFiltered).toHaveBeenCalledWith(
      '1_records_raw/en/111.html',
      'en',
    );
  });
  it('does not copy when the title is not in the filtered set', async () => {
    site.extractRecordTitleFromHtml.mockReturnValue('Widget Alpha');
    storage.readFilteredRecordTitles.mockResolvedValue(
      new Set(['Other Title']),
    );
    const service = await buildService();
    await service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' });
    expect(storage.copyRecordDetailToFiltered).not.toHaveBeenCalled();
  });
  it('does not copy or look up filtered titles when no title could be extracted', async () => {
    site.extractRecordTitleFromHtml.mockReturnValue(null);
    const service = await buildService();
    await service.run({
      runId: 'run-1',
      fileKey: '1_records_raw/expired/111.html',
    });
    expect(storage.readFilteredRecordTitles).not.toHaveBeenCalled();
    expect(storage.copyRecordDetailToFiltered).not.toHaveBeenCalled();
  });
  it('propagates errors from extraction and never copies', async () => {
    site.extractRecordTitleFromHtml.mockImplementation(() => {
      throw new Error('boom');
    });
    const service = await buildService();
    await expect(
      service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' }),
    ).rejects.toThrow('boom');
    expect(storage.copyRecordDetailToFiltered).not.toHaveBeenCalled();
  });
});
