import { ApiProperty } from '@nestjs/swagger';
export class ListingContinueResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty()
  fromRunId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
