import { Test, TestingModule } from '@nestjs/testing';
import { SiteService } from '@app/site';
import { StorageService } from '@app/storage';
import { RecordLanguageClassifyService } from './record-language-classify.service.js';
function enoent(): NodeJS.ErrnoException {
  const error = new Error('ENOENT') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}
describe('RecordLanguageClassifyService', () => {
  let site: {
    extractBodyContentTextFromHtml: ReturnType<typeof vi.fn>;
  };
  let storage: {
    expiredRecordDetailPath: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    moveExpiredRecordToLanguageBucket: ReturnType<typeof vi.fn>;
  };
  function expiredKey(recordId: string): string {
    return `1_records_raw/expired/${recordId}.html`;
  }
  async function buildService(): Promise<RecordLanguageClassifyService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordLanguageClassifyService,
        { provide: SiteService, useValue: site },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return module.get<RecordLanguageClassifyService>(
      RecordLanguageClassifyService,
    );
  }
  beforeEach(() => {
    site = { extractBodyContentTextFromHtml: vi.fn() };
    storage = {
      expiredRecordDetailPath: vi.fn((recordId: string) =>
        expiredKey(recordId),
      ),
      read: vi.fn().mockResolvedValue('<div>Recently updated</div>'),
      moveExpiredRecordToLanguageBucket: vi.fn().mockResolvedValue(undefined),
    };
  });
  it('reads the expired html by key, guesses the language, and moves the file', async () => {
    const bodyContentText =
      'Our platform focuses on distributed systems and scalable APIs, with new capabilities rolling out this quarter for existing users.';
    site.extractBodyContentTextFromHtml.mockReturnValue(bodyContentText);
    const service = await buildService();
    await service.run({ runId: 'run-1', recordId: '123' });
    expect(storage.read).toHaveBeenCalledWith('1_records_raw/expired/123.html');
    expect(site.extractBodyContentTextFromHtml).toHaveBeenCalledWith(
      '<div>Recently updated</div>',
      '123',
    );
    expect(storage.moveExpiredRecordToLanguageBucket).toHaveBeenCalledWith(
      '123',
      'en',
      '<div>Recently updated</div>',
    );
  });
  it("falls back to the 'xx' bucket when no body content could be read", async () => {
    storage.read.mockResolvedValue('<div></div>');
    site.extractBodyContentTextFromHtml.mockReturnValue(null);
    const service = await buildService();
    await service.run({ runId: 'run-1', recordId: '123' });
    expect(storage.moveExpiredRecordToLanguageBucket).toHaveBeenCalledWith(
      '123',
      'xx',
      '<div></div>',
    );
  });
  it('skips without touching extraction or storage when the expired file is missing', async () => {
    storage.read.mockRejectedValue(enoent());
    const service = await buildService();
    await service.run({ runId: 'run-1', recordId: 'missing' });
    expect(site.extractBodyContentTextFromHtml).not.toHaveBeenCalled();
    expect(storage.moveExpiredRecordToLanguageBucket).not.toHaveBeenCalled();
  });
  it('propagates a non-ENOENT read error instead of skipping the record', async () => {
    const boom = new Error('disk on fire') as NodeJS.ErrnoException;
    boom.code = 'EACCES';
    storage.read.mockRejectedValue(boom);
    const service = await buildService();
    await expect(service.run({ runId: 'run-1', recordId: '123' })).rejects.toBe(
      boom,
    );
    expect(site.extractBodyContentTextFromHtml).not.toHaveBeenCalled();
    expect(storage.moveExpiredRecordToLanguageBucket).not.toHaveBeenCalled();
  });
  it('propagates errors from extraction and never moves the file', async () => {
    site.extractBodyContentTextFromHtml.mockImplementation(() => {
      throw new Error('boom');
    });
    const service = await buildService();
    await expect(
      service.run({ runId: 'run-1', recordId: '123' }),
    ).rejects.toThrow('boom');
    expect(storage.moveExpiredRecordToLanguageBucket).not.toHaveBeenCalled();
  });
});
