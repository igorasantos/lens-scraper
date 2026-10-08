/* v8 ignore file */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SESSION_MODES, type SessionMode } from '@app/site';
import { DetailModeRequestDto } from '../../common/detail-mode-request.dto.js';
export class ListingInitRequestDto extends DetailModeRequestDto {
  @ApiProperty({ enum: SESSION_MODES })
  @IsIn(SESSION_MODES)
  listing_mode!: SessionMode;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  baseUrl?: string;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  startPage?: number;
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
