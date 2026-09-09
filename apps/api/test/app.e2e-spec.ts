import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { QueueService } from '@app/queue';
import { ApiModule } from './../src/api.module.js';
describe('ScrapeController (e2e)', () => {
  let app: INestApplication<App>;
  let queue: {
    publishListingInit: ReturnType<typeof vi.fn>;
    publishRecordDetailsBatch: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    queue = {
      publishListingInit: vi.fn().mockResolvedValue(undefined),
      publishRecordDetailsBatch: vi.fn().mockResolvedValue(undefined),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    })
      .overrideProvider(QueueService)
      .useValue(queue)
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
    it('202s with a runId and publishes to the queue', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 'https://example.com/search' })
        .expect(202);
      expect(response.body).toMatchObject({ status: 'queued' });
      expect(typeof response.body.runId).toBe('string');
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: response.body.runId,
        baseUrl: 'https://example.com/search',
        startPage: undefined,
      });
    });
    it('accepts and forwards a startPage', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 'https://example.com/search', startPage: 3 })
        .expect(202);
      expect(queue.publishListingInit).toHaveBeenCalledWith({
        runId: response.body.runId,
        baseUrl: 'https://example.com/search',
        startPage: 3,
      });
    });
    it('rejects a negative startPage', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 'https://example.com/search', startPage: -1 })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('falls back to the configured default baseUrl when the body omits it', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({})
        .expect(202);
      expect(response.body.status).toBe('queued');
      expect(queue.publishListingInit).toHaveBeenCalledTimes(1);
    });
    it('rejects unknown fields in the body', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 'https://example.com', extra: 'nope' })
        .expect(400);
      expect(queue.publishListingInit).not.toHaveBeenCalled();
    });
    it('rejects a non-string baseUrl', async () => {
      await request(app.getHttpServer())
        .post('/scrape/listing/init')
        .send({ baseUrl: 123 })
        .expect(400);
    });
  });
  describe('POST /scrape/records/details', () => {
    it('202s with the recordId, status and a scheduledAt, and publishes to the queue', async () => {
      const response = await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send(['4242'])
        .expect(202);
      expect(response.body).toMatchObject([
        { recordId: '4242', status: 'queued' },
      ]);
      expect(typeof response.body[0].scheduledAt).toBe('string');
      expect(queue.publishRecordDetailsBatch).toHaveBeenCalledWith([
        { recordId: '4242', scheduledAt: response.body[0].scheduledAt },
      ]);
    });
    it('rejects an empty body', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send([])
        .expect(400);
      expect(queue.publishRecordDetailsBatch).not.toHaveBeenCalled();
    });
    it('rejects a non-numeric recordId', async () => {
      await request(app.getHttpServer())
        .post('/scrape/records/details')
        .send(['not-a-number'])
        .expect(400);
    });
  });
});
