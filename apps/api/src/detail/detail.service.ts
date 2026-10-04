import { BadRequestException, Injectable } from '@nestjs/common';
import { QueueService, stampScheduledAt } from '@app/queue';
import { generateRunId } from '../common/run-id.util.js';
import {
  RECORD_ID_PATTERN,
  type RecordDetailsRequestDto,
} from './dto/record-details-request.dto.js';
import type { RecordDetailsResponseDto } from './dto/record-details-response.dto.js';
import type { ExpiredReprocessResponseDto } from './dto/expired-reprocess-response.dto.js';
import type { XxReprocessResponseDto } from './dto/xx-reprocess-response.dto.js';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class DetailService {
  constructor(private readonly queue: QueueService) {}
  async queueRecordDetails(
    recordIds: RecordDetailsRequestDto,
  ): Promise<RecordDetailsResponseDto[]> {
    if (recordIds.length === 0) {
      throw new BadRequestException('recordIds must not be empty');
    }
    const invalid = recordIds.filter(
      (recordId) => !RECORD_ID_PATTERN.test(recordId),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `recordId must be numeric: ${invalid.join(', ')}`,
      );
    }
    const scheduled = stampScheduledAt([...new Set(recordIds)]);
    await this.queue.publishRecordDetailsBatch(scheduled);
    return scheduled.map(({ recordId, scheduledAt }) => ({
      recordId,
      status: 'queued' as const,
      scheduledAt,
    }));
  }
  async reprocessExpiredRecords(): Promise<ExpiredReprocessResponseDto> {
    const runId = generateRunId();
    await this.queue.publishExpiredReprocess({ runId });
    return { runId, status: 'queued' };
  }
  async reprocessXxRecords(): Promise<XxReprocessResponseDto> {
    const runId = generateRunId();
    await this.queue.publishXxReprocess({ runId });
    return { runId, status: 'queued' };
  }
}
