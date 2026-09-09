import { Test, TestingModule } from '@nestjs/testing';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { RecordTitleExtractService } from './record-title-extract.service.js';
describe('RecordTitleExtractService', () => {
  let site: {
    extractRecordTitleFromHtml: ReturnType<typeof vi.fn>;
  };
  let storage: {
    read: ReturnType<typeof vi.fn>;
    appendRawRecordTitle: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<RecordTitleExtractService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordTitleExtractService,
        { provide: SiteService, useValue: site },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<RecordTitleExtractService>(RecordTitleExtractService);
  }
  beforeEach(() => {
    site = { extractRecordTitleFromHtml: vi.fn() };
    storage = {
      read: vi.fn().mockResolvedValue('<div>111</div>'),
      appendRawRecordTitle: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('reads the file by key and appends the extracted title', async () => {
    site.extractRecordTitleFromHtml.mockReturnValue('Widget Alpha');
    const service = await buildService();
    await service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' });
    expect(storage.read).toHaveBeenCalledWith('1_records_raw/en/111.html');
    expect(site.extractRecordTitleFromHtml).toHaveBeenCalledWith(
      '<div>111</div>',
    );
    expect(storage.appendRawRecordTitle).toHaveBeenCalledWith('Widget Alpha');
  });
  it('does not append anything when no title could be extracted', async () => {
    site.extractRecordTitleFromHtml.mockReturnValue(null);
    const service = await buildService();
    await service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' });
    expect(storage.appendRawRecordTitle).not.toHaveBeenCalled();
  });
  it('propagates errors from extraction and never appends', async () => {
    site.extractRecordTitleFromHtml.mockImplementation(() => {
      throw new Error('boom');
    });
    const service = await buildService();
    await expect(
      service.run({ runId: 'run-1', fileKey: '1_records_raw/en/111.html' }),
    ).rejects.toThrow('boom');
    expect(storage.appendRawRecordTitle).not.toHaveBeenCalled();
  });
});
