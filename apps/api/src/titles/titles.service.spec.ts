import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '@app/queue';
import { TitlesService } from './titles.service.js';
describe('TitlesService', () => {
  let queue: {
    publishRecordTitlesExtract: ReturnType<typeof vi.fn>;
    publishRecordTitlesDedupSort: ReturnType<typeof vi.fn>;
    publishRecordTitlesFilter: ReturnType<typeof vi.fn>;
  };
  async function buildService(): Promise<TitlesService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TitlesService, { provide: QueueService, useValue: queue }],
    }).compile();
    return module.get<TitlesService>(TitlesService);
  }
  beforeEach(() => {
    queue = {
      publishRecordTitlesExtract: vi.fn().mockResolvedValue(undefined),
      publishRecordTitlesDedupSort: vi.fn().mockResolvedValue(undefined),
      publishRecordTitlesFilter: vi.fn().mockResolvedValue(undefined),
    };
  });
  describe('extractRecordTitles', () => {
    it('publishes a record titles extract message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.extractRecordTitles();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesExtract).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.extractRecordTitles();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('dedupSortRecordTitles', () => {
    it('publishes a record titles dedup-sort message with a generated runId', async () => {
      const service = await buildService();
      const result = await service.dedupSortRecordTitles();
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesDedupSort).toHaveBeenCalledWith({
        runId: result.runId,
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.dedupSortRecordTitles();
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
  describe('filterRecordTitles', () => {
    it('publishes a record titles filter message with a generated runId and the given substrings', async () => {
      const service = await buildService();
      const result = await service.filterRecordTitles({
        substrings: ['Laptop', 'home'],
      });
      expect(result.status).toBe('queued');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(queue.publishRecordTitlesFilter).toHaveBeenCalledWith({
        runId: result.runId,
        substrings: ['Laptop', 'home'],
      });
    });
    it('generates the runId as an ISO-8601 UTC timestamp', async () => {
      const service = await buildService();
      const result = await service.filterRecordTitles({ substrings: ['x'] });
      expect(result.runId).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
