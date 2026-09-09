import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { QueueService, stampScheduledAt } from '@app/queue';
import type { ListingInitRequestDto } from './dto/listing-init-request.dto.js';
import type { ListingInitResponseDto } from './dto/listing-init-response.dto.js';
import type { ListingContinueResponseDto } from './dto/listing-continue-response.dto.js';
import { RUN_ID_PATTERN } from './dto/listing-continue-request.dto.js';
import {
  RECORD_ID_PATTERN,
  type RecordDetailsRequestDto,
} from './dto/record-details-request.dto.js';
import type { RecordDetailsResponseDto } from './dto/record-details-response.dto.js';
import type { ExpiredReprocessResponseDto } from './dto/expired-reprocess-response.dto.js';
import type { XxReprocessResponseDto } from './dto/xx-reprocess-response.dto.js';
import type { RecordTitlesExtractResponseDto } from './dto/record-titles-extract-response.dto.js';
import type { RecordTitlesDedupSortResponseDto } from './dto/record-titles-dedup-sort-response.dto.js';
import type { RecordTitlesFilterRequestDto } from './dto/record-titles-filter-request.dto.js';
import type { RecordTitlesFilterResponseDto } from './dto/record-titles-filter-response.dto.js';
import type { RecordsFilterResponseDto } from './dto/records-filter-response.dto.js';
function generateRunId(): string {
  return new Date().toISOString();
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class ScrapeService {
  constructor(
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}
  async initListing(
    dto: ListingInitRequestDto,
  ): Promise<ListingInitResponseDto> {
    const baseUrl = dto.baseUrl ?? this.config.siteBaseListingUrl;
    if (!baseUrl) {
      throw new BadRequestException(
        'baseUrl is required (no SITE_BASE_LISTING_URL configured as default)',
      );
    }
    const runId = generateRunId();
    await this.queue.publishListingInit({
      runId,
      baseUrl,
      startPage: dto.startPage,
    });
    return { runId, status: 'queued' };
  }
  async continueListing(
    fromRunId: string,
  ): Promise<ListingContinueResponseDto> {
    if (!RUN_ID_PATTERN.test(fromRunId)) {
      throw new BadRequestException(
        `fromRunId contains invalid characters: ${fromRunId}`,
      );
    }
    const runId = generateRunId();
    await this.queue.publishListingContinue({ runId, fromRunId });
    return { runId, fromRunId, status: 'queued' };
  }
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
    const scheduled = stampScheduledAt(recordIds);
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
  async filterRecords(): Promise<RecordsFilterResponseDto> {
    const runId = generateRunId();
    await this.queue.publishRecordsFilter({ runId });
    return { runId, status: 'queued' };
  }
}
