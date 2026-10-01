import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { RecordDetailsRequestDto } from './dto/record-details-request.dto.js';
import { RecordDetailsResponseDto } from './dto/record-details-response.dto.js';
import { ExpiredReprocessResponseDto } from './dto/expired-reprocess-response.dto.js';
import { XxReprocessResponseDto } from './dto/xx-reprocess-response.dto.js';
import { DetailService } from './detail.service.js';
/* v8 ignore start */
@ApiTags('scrape')
@Controller('scrape')
/* v8 ignore stop */
export class DetailController {
  constructor(private readonly detailService: DetailService) {}
  @Post('records/details')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: [String] })
  @ApiOkResponse({ type: [RecordDetailsResponseDto] })
  queueRecordDetails(
    @Body(new ParseArrayPipe({ items: String }))
    recordIds: RecordDetailsRequestDto,
  ): Promise<RecordDetailsResponseDto[]> {
    return this.detailService.queueRecordDetails(recordIds);
  }
  @Post('records/expired/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ExpiredReprocessResponseDto })
  reprocessExpiredRecords(): Promise<ExpiredReprocessResponseDto> {
    return this.detailService.reprocessExpiredRecords();
  }
  @Post('records/xx/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: XxReprocessResponseDto })
  reprocessXxRecords(): Promise<XxReprocessResponseDto> {
    return this.detailService.reprocessXxRecords();
  }
}
