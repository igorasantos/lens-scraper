import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { ALL_TOPICS } from '@app/queue';
import { DlqService } from './dlq.service.js';
import { DeadLetterQueryDto } from './dto/dead-letter-query.dto.js';
import { DeadLetterMessagesResponseDto } from './dto/dead-letter-messages-response.dto.js';
@ApiTags('dlq')
@Controller('dlq')
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}
  @Get(':topic')
  @ApiParam({ name: 'topic', enum: ALL_TOPICS })
  @ApiOkResponse({ type: DeadLetterMessagesResponseDto })
  listDeadLetters(
    @Param('topic')
    topic: string,
    @Query()
    query: DeadLetterQueryDto,
  ): Promise<DeadLetterMessagesResponseDto> {
    if (!ALL_TOPICS.includes(topic as (typeof ALL_TOPICS)[number])) {
      throw new BadRequestException(`Unknown topic: ${topic}`);
    }
    return this.dlqService.list(topic, query.limit);
  }
}
