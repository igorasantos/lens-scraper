import { ApiProperty } from '@nestjs/swagger';
export class ListingInitResponseDto {
  @ApiProperty()
  runId!: string;
  @ApiProperty({ enum: ['queued'] })
  status!: 'queued';
}
