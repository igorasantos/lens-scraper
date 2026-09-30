import { ApiProperty } from '@nestjs/swagger';
export class PendingReprocessResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty()
  fromRunId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
