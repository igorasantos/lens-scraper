import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListingInitRequestDto } from './dto/listing-init-request.dto.js';
import { ListingInitResponseDto } from './dto/listing-init-response.dto.js';
import { PendingReprocessResponseDto } from './dto/pending-reprocess-response.dto.js';
import type { RecordDetailsRequestDto } from './dto/record-details-request.dto.js';
import { RecordDetailsResponseDto } from './dto/record-details-response.dto.js';
import { ExpiredReprocessResponseDto } from './dto/expired-reprocess-response.dto.js';
import { XxReprocessResponseDto } from './dto/xx-reprocess-response.dto.js';
import { RecordTitlesExtractResponseDto } from './dto/record-titles-extract-response.dto.js';
import { RecordTitlesDedupSortResponseDto } from './dto/record-titles-dedup-sort-response.dto.js';
import { RecordTitlesFilterRequestDto } from './dto/record-titles-filter-request.dto.js';
import { RecordTitlesFilterResponseDto } from './dto/record-titles-filter-response.dto.js';
import { RecordsFilterResponseDto } from './dto/records-filter-response.dto.js';
import { ScrapeService } from './scrape.service.js';
/* v8 ignore start */
@ApiTags('scrape')
@Controller('scrape')
/* v8 ignore stop */
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}
  @Post('listing/init')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ListingInitResponseDto })
  initListing(
    @Body()
    dto: ListingInitRequestDto,
  ): Promise<ListingInitResponseDto> {
    return this.scrapeService.initListing(dto);
  }
  @Post('records/details')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: [String] })
  @ApiOkResponse({ type: [RecordDetailsResponseDto] })
  queueRecordDetails(
    @Body(new ParseArrayPipe({ items: String }))
    recordIds: RecordDetailsRequestDto,
  ): Promise<RecordDetailsResponseDto[]> {
    return this.scrapeService.queueRecordDetails(recordIds);
  }
  @Post('records/expired/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ExpiredReprocessResponseDto })
  reprocessExpiredRecords(): Promise<ExpiredReprocessResponseDto> {
    return this.scrapeService.reprocessExpiredRecords();
  }
  @Post('records/xx/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: XxReprocessResponseDto })
  reprocessXxRecords(): Promise<XxReprocessResponseDto> {
    return this.scrapeService.reprocessXxRecords();
  }
  @Post('records/pending/:fromRunId/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: PendingReprocessResponseDto })
  reprocessPendingRecords(
    @Param('fromRunId')
    fromRunId: string,
  ): Promise<PendingReprocessResponseDto> {
    return this.scrapeService.reprocessPendingRecords(fromRunId);
  }
  @Post('records/titles/extract')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesExtractResponseDto })
  extractRecordTitles(): Promise<RecordTitlesExtractResponseDto> {
    return this.scrapeService.extractRecordTitles();
  }
  @Post('records/titles/dedup-sort')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesDedupSortResponseDto })
  dedupSortRecordTitles(): Promise<RecordTitlesDedupSortResponseDto> {
    return this.scrapeService.dedupSortRecordTitles();
  }
  @Post('records/titles/filter')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesFilterResponseDto })
  filterRecordTitles(
    @Body()
    dto: RecordTitlesFilterRequestDto,
  ): Promise<RecordTitlesFilterResponseDto> {
    return this.scrapeService.filterRecordTitles(dto);
  }
  @Post('records/filter')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordsFilterResponseDto })
  filterRecords(): Promise<RecordsFilterResponseDto> {
    return this.scrapeService.filterRecords();
  }
}
