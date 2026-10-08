import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DetailModeRequestDto } from '../common/detail-mode-request.dto.js';
import { RecordDetailsRequestDto } from './dto/record-details-request.dto.js';
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
  @ApiOkResponse({ type: [RecordDetailsResponseDto] })
  queueRecordDetails(
    @Body()
    dto: RecordDetailsRequestDto,
  ): Promise<RecordDetailsResponseDto[]> {
    return this.detailService.queueRecordDetails(dto);
  }
  @Post('records/expired/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ExpiredReprocessResponseDto })
  reprocessExpiredRecords(
    @Body()
    dto: DetailModeRequestDto,
  ): Promise<ExpiredReprocessResponseDto> {
    return this.detailService.reprocessExpiredRecords(dto);
  }
  @Post('records/xx/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: XxReprocessResponseDto })
  reprocessXxRecords(
    @Body()
    dto: DetailModeRequestDto,
  ): Promise<XxReprocessResponseDto> {
    return this.detailService.reprocessXxRecords(dto);
  }
}
