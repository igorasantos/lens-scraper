import { Injectable } from '@nestjs/common';
import { ConfigService } from '@app/config';
import { peekDeadLetterMessages, toDeadLetterTopic } from '@app/queue';
import type { DeadLetterMessagesResponseDto } from './dto/dead-letter-messages-response.dto.js';
const DEFAULT_LIMIT = 20;
@Injectable()
export class DlqService {
  constructor(private readonly config: ConfigService) {}
  async list(
    topic: string,
    limit = DEFAULT_LIMIT,
  ): Promise<DeadLetterMessagesResponseDto> {
    const messages = await peekDeadLetterMessages(
      this.config.kafkaBrokers,
      toDeadLetterTopic(topic),
      limit,
    );
    return { topic, count: messages.length, messages };
  }
}
