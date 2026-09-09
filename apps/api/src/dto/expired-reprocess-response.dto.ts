import { ApiProperty } from '@nestjs/swagger';
export class ExpiredReprocessResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
