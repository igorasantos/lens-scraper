import { Injectable } from '@nestjs/common';
import { QueueService } from '@app/queue';
import { generateRunId } from '../common/run-id.util.js';
import type { RecordsFilterResponseDto } from './dto/records-filter-response.dto.js';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class FilterService {
  constructor(private readonly queue: QueueService) {}
  async filterRecords(): Promise<RecordsFilterResponseDto> {
    const runId = generateRunId();
    await this.queue.publishRecordsFilter({ runId });
    return { runId, status: 'queued' };
  }
}
