import { Injectable } from '@nestjs/common';
import { QueueService } from '@app/queue';
import { generateRunId } from '../common/run-id.util.js';
import type { RecordTitlesExtractResponseDto } from './dto/record-titles-extract-response.dto.js';
import type { RecordTitlesDedupSortResponseDto } from './dto/record-titles-dedup-sort-response.dto.js';
import type { RecordTitlesFilterRequestDto } from './dto/record-titles-filter-request.dto.js';
import type { RecordTitlesFilterResponseDto } from './dto/record-titles-filter-response.dto.js';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class TitlesService {
  constructor(private readonly queue: QueueService) {}
  async extractRecordTitles(): Promise<RecordTitlesExtractResponseDto> {
    const runId = generateRunId();
    await this.queue.publishRecordTitlesExtract({ runId });
    return { runId, status: 'queued' };
  }
  async dedupSortRecordTitles(): Promise<RecordTitlesDedupSortResponseDto> {
    const runId = generateRunId();
    await this.queue.publishRecordTitlesDedupSort({ runId });
    return { runId, status: 'queued' };
  }
  async filterRecordTitles(
    dto: RecordTitlesFilterRequestDto,
  ): Promise<RecordTitlesFilterResponseDto> {
    const runId = generateRunId();
    await this.queue.publishRecordTitlesFilter({
      runId,
      substrings: dto.substrings,
    });
    return { runId, status: 'queued' };
  }
}
