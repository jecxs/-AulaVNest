// live-sessions/dto/create-live-session.dto.ts
import {
  IsString,
  IsDateString,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateLiveSessionDto {
  @IsString()
  @MaxLength(200)
  topic: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsUrl({}, { message: 'Meeting URL must be a valid URL' })
  meetingUrl?: string;

  @IsString()
  courseId: string;
}
