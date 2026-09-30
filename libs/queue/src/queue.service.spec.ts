import { Test, TestingModule } from '@nestjs/testing';
import { QUEUE_PORT } from './queue-port.token.js';
import { QueueService } from './queue.service.js';
import {
  SCRAPE_RECORD_DETAIL_TOPIC,
  SCRAPE_RECORD_FILTER_COPY_TOPIC,
  SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
  SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
  SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
  SCRAPE_RECORD_TITLES_FILTER_TOPIC,
  SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
  SCRAPE_RECORDS_FILTER_TOPIC,
  SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
  SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
  SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
  SCRAPE_LISTING_INIT_TOPIC,
  SCRAPE_LISTING_PAGE_TOPIC,
} from './topics.js';
describe('QueueService', () => {
  let service: QueueService;
  let queuePort: {
    publish: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    queuePort = { publish: vi.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService, { provide: QUEUE_PORT, useValue: queuePort }],
    }).compile();
    service = module.get<QueueService>(QueueService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('publishes a listing init message to the listing topic', async () => {
    const message = { runId: 'run-1', baseUrl: 'https://example.com' };
    await service.publishListingInit(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_LISTING_INIT_TOPIC,
      message,
    );
  });
  it('publishes a pending reprocess message to the pending reprocess topic', async () => {
    const message = { runId: 'run-2', fromRunId: 'run-1' };
    await service.publishPendingReprocess(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORDS_PENDING_REPROCESS_TOPIC,
      message,
    );
  });
  it('publishes a listing page message to the listing page topic', async () => {
    const message = {
      runId: 'run-1',
      baseUrl: 'https://example.com',
      pagesVisited: 1,
      recordIds: ['1', '2'],
      lockToken: 'token-1',
      scheduledAt: '2026-01-01T00:00:00.000Z',
    };
    await service.publishListingPage(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_LISTING_PAGE_TOPIC,
      message,
    );
  });
  it('publishes a batch of record detail messages, one publish call per message', async () => {
    const messages = [
      { recordId: '1', scheduledAt: '2026-01-01T00:00:00.000Z' },
      { recordId: '2', scheduledAt: '2026-01-01T00:00:02.000Z' },
    ];
    await service.publishRecordDetailsBatch(messages);
    expect(queuePort.publish).toHaveBeenCalledTimes(2);
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      1,
      SCRAPE_RECORD_DETAIL_TOPIC,
      messages[0],
    );
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      2,
      SCRAPE_RECORD_DETAIL_TOPIC,
      messages[1],
    );
  });
  it('does nothing when the batch is empty', async () => {
    await service.publishRecordDetailsBatch([]);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
  it('publishes an expired reprocess message to the expired reprocess topic', async () => {
    const message = { runId: 'run-1' };
    await service.publishExpiredReprocess(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORDS_EXPIRED_REPROCESS_TOPIC,
      message,
    );
  });
  it('publishes an xx reprocess message to the xx reprocess topic', async () => {
    const message = { runId: 'run-1' };
    await service.publishXxReprocess(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORDS_XX_REPROCESS_TOPIC,
      message,
    );
  });
  it('publishes a record titles extract message to the titles extract topic', async () => {
    const message = { runId: 'run-1' };
    await service.publishRecordTitlesExtract(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORDS_TITLES_EXTRACT_TOPIC,
      message,
    );
  });
  it('publishes a record title extract message to the record title extract topic', async () => {
    const message = { runId: 'run-1', fileKey: '1_records_raw/en/111.html' };
    await service.publishRecordTitleExtract(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
      message,
    );
  });
  it('publishes one record title extract message per file in a batch', async () => {
    const messages = [
      { runId: 'run-1', fileKey: '1_records_raw/en/111.html' },
      { runId: 'run-1', fileKey: '1_records_raw/pt/222.html' },
    ];
    await service.publishRecordTitleExtractsBatch(messages);
    expect(queuePort.publish).toHaveBeenCalledTimes(2);
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      1,
      SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
      messages[0],
    );
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      2,
      SCRAPE_RECORD_TITLE_EXTRACT_TOPIC,
      messages[1],
    );
  });
  it('does nothing when the record title extract batch is empty', async () => {
    await service.publishRecordTitleExtractsBatch([]);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
  it('publishes a record titles dedup-sort message to the dedup-sort topic', async () => {
    const message = { runId: 'run-1' };
    await service.publishRecordTitlesDedupSort(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORD_TITLES_DEDUP_SORT_TOPIC,
      message,
    );
  });
  it('publishes a record titles filter message to the filter topic', async () => {
    const message = { runId: 'run-1', substrings: ['laptop'] };
    await service.publishRecordTitlesFilter(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORD_TITLES_FILTER_TOPIC,
      message,
    );
  });
  it('publishes a records filter message to the records filter topic', async () => {
    const message = { runId: 'run-1' };
    await service.publishRecordsFilter(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORDS_FILTER_TOPIC,
      message,
    );
  });
  it('publishes a record filter copy message to the record filter copy topic', async () => {
    const message = {
      runId: 'run-1',
      fileKey: '1_records_raw/en/111.html',
    };
    await service.publishRecordFilterCopy(message);
    expect(queuePort.publish).toHaveBeenCalledWith(
      SCRAPE_RECORD_FILTER_COPY_TOPIC,
      message,
    );
  });
  it('publishes one record filter copy message per file in a batch', async () => {
    const messages = [
      { runId: 'run-1', fileKey: '1_records_raw/en/111.html' },
      { runId: 'run-1', fileKey: '1_records_raw/expired/222.html' },
    ];
    await service.publishRecordFilterCopiesBatch(messages);
    expect(queuePort.publish).toHaveBeenCalledTimes(2);
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      1,
      SCRAPE_RECORD_FILTER_COPY_TOPIC,
      messages[0],
    );
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      2,
      SCRAPE_RECORD_FILTER_COPY_TOPIC,
      messages[1],
    );
  });
  it('does nothing when the record filter copy batch is empty', async () => {
    await service.publishRecordFilterCopiesBatch([]);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
  it('publishes one record language classify message per record in a batch', async () => {
    const messages = [
      { runId: 'run-1', recordId: '111' },
      { runId: 'run-1', recordId: '222' },
    ];
    await service.publishRecordLanguageClassifyBatch(messages);
    expect(queuePort.publish).toHaveBeenCalledTimes(2);
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      1,
      SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
      messages[0],
    );
    expect(queuePort.publish).toHaveBeenNthCalledWith(
      2,
      SCRAPE_RECORD_LANGUAGE_CLASSIFY_TOPIC,
      messages[1],
    );
  });
  it('does nothing when the record language classify batch is empty', async () => {
    await service.publishRecordLanguageClassifyBatch([]);
    expect(queuePort.publish).not.toHaveBeenCalled();
  });
});
