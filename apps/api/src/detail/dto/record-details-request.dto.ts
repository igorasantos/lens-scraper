/* v8 ignore file */
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DetailModeRequestDto } from '../../common/detail-mode-request.dto.js';
export const RECORD_ID_PATTERN = /^\d+$/;
export class RecordDetailsRequestDto extends DetailModeRequestDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  records_to_reprocess!: string[];
}
