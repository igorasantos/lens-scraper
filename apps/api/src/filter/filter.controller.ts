import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RecordsFilterResponseDto } from './dto/records-filter-response.dto.js';
import { FilterService } from './filter.service.js';
/* v8 ignore start */
@ApiTags('scrape')
@Controller('scrape')
/* v8 ignore stop */
export class FilterController {
  constructor(private readonly filterService: FilterService) {}
  @Post('records/filter')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: RecordsFilterResponseDto })
  filterRecords(): Promise<RecordsFilterResponseDto> {
    return this.filterService.filterRecords();
  }
}
