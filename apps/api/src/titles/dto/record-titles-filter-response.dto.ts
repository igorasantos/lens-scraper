import { ApiProperty } from '@nestjs/swagger';
export class RecordTitlesFilterResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
