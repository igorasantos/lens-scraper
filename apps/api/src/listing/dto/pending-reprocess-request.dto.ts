/* v8 ignore file */
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export const RUN_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
export class PendingReprocessRequestDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recycle?: boolean;
}
