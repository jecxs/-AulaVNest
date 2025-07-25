// live-sessions/dto/bulk-live-sessions.dto.ts
import {
  IsArray,
  IsString,
  ValidateNested,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkLiveSessionDto {
  @IsString()
  @MaxLength(200)
  topic: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  meetingUrl?: string;
}

export class CreateBulkLiveSessionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkLiveSessionDto)
  sessions: BulkLiveSessionDto[];

  @IsString()
  courseId: string;
}
