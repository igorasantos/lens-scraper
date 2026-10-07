/* v8 ignore file */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class ListingInitRequestDto {
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
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dispatchCount?: number;
}
