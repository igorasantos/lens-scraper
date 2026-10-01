import { ApiProperty } from '@nestjs/swagger';
export class RecordsFilterResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
