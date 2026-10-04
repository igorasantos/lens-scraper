import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListingInitRequestDto } from './dto/listing-init-request.dto.js';
import { ListingInitResponseDto } from './dto/listing-init-response.dto.js';
import { PendingReprocessRequestDto } from './dto/pending-reprocess-request.dto.js';
import { PendingReprocessResponseDto } from './dto/pending-reprocess-response.dto.js';
import { ListingService } from './listing.service.js';
/* v8 ignore start */
@ApiTags('scrape')
@Controller('scrape')
/* v8 ignore stop */
export class ListingController {
  constructor(private readonly listingService: ListingService) {}
  @Post('listing/init')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: ListingInitResponseDto })
  initListing(
    @Body()
    dto: ListingInitRequestDto,
  ): Promise<ListingInitResponseDto> {
    return this.listingService.initListing(dto);
  }
  @Post('records/pending/:fromRunId/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: PendingReprocessResponseDto })
  reprocessPendingRecords(
    @Param('fromRunId')
    fromRunId: string,
    @Body()
    dto: PendingReprocessRequestDto,
  ): Promise<PendingReprocessResponseDto> {
    return this.listingService.reprocessPendingRecords(fromRunId, dto);
  }
}
