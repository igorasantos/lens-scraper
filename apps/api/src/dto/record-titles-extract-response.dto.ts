import { ApiProperty } from '@nestjs/swagger';
export class RecordTitlesExtractResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
