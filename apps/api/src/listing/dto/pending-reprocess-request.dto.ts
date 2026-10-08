/* v8 ignore file */
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DetailModeRequestDto } from '../../common/detail-mode-request.dto.js';
export const RUN_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
export class PendingReprocessRequestDto extends DetailModeRequestDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recycle?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dispatchCount?: number;
}
