import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { QueueService } from '@app/queue';
import { generateRunId } from '../common/run-id.util.js';
import type { ListingInitRequestDto } from './dto/listing-init-request.dto.js';
import type { ListingInitResponseDto } from './dto/listing-init-response.dto.js';
import type { PendingReprocessResponseDto } from './dto/pending-reprocess-response.dto.js';
import { RUN_ID_PATTERN } from './dto/pending-reprocess-request.dto.js';
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class ListingService {
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
  async reprocessPendingRecords(
    fromRunId: string,
  ): Promise<PendingReprocessResponseDto> {
    if (!RUN_ID_PATTERN.test(fromRunId)) {
      throw new BadRequestException(
        `fromRunId contains invalid characters: ${fromRunId}`,
      );
    }
    const runId = generateRunId();
    await this.queue.publishPendingReprocess({ runId, fromRunId });
    return { runId, fromRunId, status: 'queued' };
  }
}
