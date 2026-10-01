import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RecordTitlesExtractResponseDto } from './dto/record-titles-extract-response.dto.js';
import { RecordTitlesDedupSortResponseDto } from './dto/record-titles-dedup-sort-response.dto.js';
import { RecordTitlesFilterRequestDto } from './dto/record-titles-filter-request.dto.js';
import { RecordTitlesFilterResponseDto } from './dto/record-titles-filter-response.dto.js';
import { TitlesService } from './titles.service.js';
/* v8 ignore start */
@ApiTags('scrape')
@Controller('scrape')
/* v8 ignore stop */
export class TitlesController {
  constructor(private readonly titlesService: TitlesService) {}
  @Post('records/titles/extract')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesExtractResponseDto })
  extractRecordTitles(): Promise<RecordTitlesExtractResponseDto> {
    return this.titlesService.extractRecordTitles();
  }
  @Post('records/titles/dedup-sort')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesDedupSortResponseDto })
  dedupSortRecordTitles(): Promise<RecordTitlesDedupSortResponseDto> {
    return this.titlesService.dedupSortRecordTitles();
  }
  @Post('records/titles/filter')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordTitlesFilterResponseDto })
  filterRecordTitles(
    @Body()
    dto: RecordTitlesFilterRequestDto,
  ): Promise<RecordTitlesFilterResponseDto> {
    return this.titlesService.filterRecordTitles(dto);
  }
}
