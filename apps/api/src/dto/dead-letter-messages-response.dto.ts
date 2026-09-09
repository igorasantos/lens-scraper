import type { DeadLetterEnvelope } from '@app/queue';
import { ApiProperty } from '@nestjs/swagger';
export class DeadLetterMessagesResponseDto {
  @ApiProperty()
  topic!: string;
  @ApiProperty()
  count!: number;
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        payload: { type: 'object' },
        attempts: { type: 'number' },
        error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            stack: { type: 'string' },
          },
        },
        failedAt: { type: 'string' },
      },
    },
  })
  messages!: DeadLetterEnvelope[];
}
