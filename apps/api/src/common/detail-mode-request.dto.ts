/* v8 ignore file */
import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SESSION_MODES, type SessionMode } from '@app/site';
export class DetailModeRequestDto {
  @ApiProperty({ enum: SESSION_MODES })
  @IsIn(SESSION_MODES)
  detail_mode!: SessionMode;
}
