import { ApiProperty } from '@nestjs/swagger';
export class RecordTitlesDedupSortResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
