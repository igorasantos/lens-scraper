import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { QueueService } from '@app/queue';
import { StorageService } from '@app/storage';
import { ApiModule } from './../src/api.module.js';
describe('ApiModule (e2e)', () => {
  let app: INestApplication<App>;
  let queue: {
    publishListingInit: ReturnType<typeof vi.fn>;
    publishPendingReprocess: ReturnType<typeof vi.fn>;
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
    publishExpiredReprocess: ReturnType<typeof vi.fn>;
    publishXxReprocess: ReturnType<typeof vi.fn>;
  };
  let storage: {
    readRecordIds: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    queue = {
      publishListingInit: vi.fn().mockResolvedValue(undefined),
      publishPendingReprocess: vi.fn().mockResolvedValue(undefined),
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
      publishExpiredReprocess: vi.fn().mockResolvedValue(undefined),
      publishXxReprocess: vi.fn().mockResolvedValue(undefined),
    };
    storage = {
      readRecordIds: vi.fn().mockResolvedValue(new Set()),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    })
      .overrideProvider(QueueService)
      .useValue(queue)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  describe('POST /scrape/listing/init', () => {
    const modes = { listing_mode: 'logged-in', detail_mode: 'logged-out' };
    it('202s with a runId and publishes to the queue', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ ...modes, baseUrl: 'https://example.com/search' })
        .expect(202);
      expect(response.body).toMatchObject({ status: 'queued' });
      expect(typeof response.body.runId).toBe('string');
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: response.body.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: undefined,
      });
    });
    it('accepts and forwards a startPage', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ ...modes, baseUrl: 'https://example.com/search', startPage: 3 })
        .expect(202);
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: response.body.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: 3,
      });
    });
    it('accepts and forwards a recycle flag', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({
          ...modes,
          baseUrl: 'https://example.com/search',
          recycle: true,
        })
        .expect(202);
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: response.body.runId,
        baseUrl: 'https://example.com/search',
        listingMode: 'logged-in',
        detailMode: 'logged-out',
        startPage: undefined,
        recycle: true,
      });
    });
    it('rejects a non-boolean recycle flag', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({
          ...modes,
          baseUrl: 'https://example.com/search',
          recycle: 'yes',
        })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('rejects a negative startPage', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({
          ...modes,
          baseUrl: 'https://example.com/search',
          startPage: -1,
        })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('rejects a missing or unknown listing_mode / detail_mode', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 'https://example.com/search' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ ...modes, detail_mode: 'logged_in' })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('falls back to the configured default baseUrl when the body omits it', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send(modes)
        .expect(202);
      expect(response.body.status).toBe('queued');
      expect(queue.publishListingInit).toHaveBeenCalledTimes(1);
    });
    it('rejects unknown fields in the body', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ ...modes, baseUrl: 'https://example.com', extra: 'nope' })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('rejects a non-string baseUrl', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ ...modes, baseUrl: 123 })
        .expect(400);
    });
  });
  describe('POST /scrape/records/pending/:fromRunId/reprocess', () => {
    it('202s with only a detail_mode and publishes without recycling', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/records/pending/run-1/reprocess')
        .send({ detail_mode: 'logged-out' })
        .expect(202);
      expect(response.body).toMatchObject({
        fromRunId: 'run-1',
        status: 'queued',
      });
      expect(queue.publishPendingReprocess).toHaveBeenCalledWith({
        runId: response.body.runId,
        fromRunId: 'run-1',
        detailMode: 'logged-out',
        recycle: undefined,
      });
    });
    it('accepts and forwards a recycle flag', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/records/pending/run-1/reprocess')
        .send({ detail_mode: 'logged-out', recycle: true })
        .expect(202);
      expect(queue.publishPendingReprocess).toHaveBeenCalledWith({
        runId: response.body.runId,
        fromRunId: 'run-1',
        detailMode: 'logged-out',
        recycle: true,
      });
    });
    it('rejects a non-boolean recycle flag', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/pending/run-1/reprocess')
        .send({ detail_mode: 'logged-out', recycle: 'yes' })
        .expect(400);
      expect(queue.publishPendingReprocess).not.toHaveBeenCalled();
    });
    it('rejects a missing detail_mode', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/pending/run-1/reprocess')
        .expect(400);
      expect(queue.publishPendingReprocess).not.toHaveBeenCalled();
    });
  });
  describe('POST /scrape/records/details', () => {
    it('202s with the recordId, status and a scheduledAt, and publishes to the queue with the detail mode', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send({ detail_mode: 'logged-in', records_to_reprocess: ['4242'] })
        .expect(202);
      expect(response.body).toMatchObject([
        { recordId: '4242', status: 'queued' },
      ]);
      expect(typeof response.body[0].scheduledAt).toBe('string');
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        {
          recordId: '4242',
          scheduledAt: response.body[0].scheduledAt,
          detailMode: 'logged-in',
        },
      ]);
    });
    it('skips duplicates and record ids already scraped', async () => {
      storage.readRecordIds.mockResolvedValue(new Set(['1111']));
      const response = await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send({
          detail_mode: 'logged-out',
          records_to_reprocess: ['1111', '4242', '4242'],
        })
        .expect(202);
      expect(response.body).toEqual([
        { recordId: '1111', status: 'skipped' },
        {
          recordId: '4242',
          status: 'queued',
          scheduledAt: response.body[1].scheduledAt,
        },
      ]);
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        {
          recordId: '4242',
          scheduledAt: response.body[1].scheduledAt,
          detailMode: 'logged-out',
        },
      ]);
    });
    it('rejects an empty records_to_reprocess', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send({ detail_mode: 'logged-out', records_to_reprocess: [] })
        .expect(400);
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
    it('rejects a non-numeric recordId', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send({
          detail_mode: 'logged-out',
          records_to_reprocess: ['not-a-number'],
        })
        .expect(400);
    });
    it('rejects the old bare-array body and a missing detail_mode', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send(['4242'])
        .expect(400);
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send({ records_to_reprocess: ['4242'] })
        .expect(400);
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
  });
  describe.each([
    ['expired', 'publishExpiredReprocess'],
    ['xx', 'publishXxReprocess'],
  ] as const)('POST /scrape/records/%s/reprocess', (bucket, publisher) => {
    it('202s and publishes with the detail mode', async () => {
      const response = await request(app.getHttpServer())
        .post(`/scrape/records/${bucket}/reprocess`)
        .send({ detail_mode: 'logged-in' })
        .expect(202);
      expect(queue[publisher]).toHaveBeenCalledWith({
        runId: response.body.runId,
        detailMode: 'logged-in',
      });
    });
    it('rejects a missing detail_mode', async () => {
      await request(app.getHttpServer())
        .post(`/scrape/records/${bucket}/reprocess`)
        .expect(400);
      expect(queue[publisher]).not.toHaveBeenCalled();
    });
  });
});
