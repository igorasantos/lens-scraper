import { ApiProperty } from '@nestjs/swagger';
export class XxReprocessResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
