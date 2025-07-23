// lessons/dto/create-lesson.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsEnum(LessonType)
  type: LessonType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  durationSec?: number;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  markdownContent?: string;

  @IsString()
  moduleId: string;
}
