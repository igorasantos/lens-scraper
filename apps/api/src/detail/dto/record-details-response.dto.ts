import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class RecordDetailsResponseDto {
  @ApiProperty()
  recordId!: string;
  @ApiProperty({ enum: ['queued', 'skipped'] })
  status!: 'queued' | 'skipped';
  @ApiPropertyOptional({
    description: 'Only present when status is queued.',
  })
  scheduledAt?: string;
}
