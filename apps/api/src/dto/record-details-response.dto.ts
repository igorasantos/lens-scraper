import { ApiProperty } from '@nestjs/swagger';
export class RecordDetailsResponseDto {
  @ApiProperty()
  recordId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
  @ApiProperty()
  scheduledAt!: string;
}
