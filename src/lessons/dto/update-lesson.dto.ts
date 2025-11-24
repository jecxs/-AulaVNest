// src/lessons/dto/update-lesson.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUrl,
  Min,
  MaxLength,
  ValidateIf
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LessonType } from '@prisma/client';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  durationSec?: number;

  @IsOptional()
  @ValidateIf((o) => o.videoUrl !== '' && o.videoUrl !== null && o.videoUrl !== undefined)
  @IsUrl({}, { message: 'videoUrl must be a valid URL' })
  @Transform(({ value }) => {
    // Transformar cadenas vacías a undefined
    if (value === '' || value === null) return undefined;
    return value;
  })
  videoUrl?: string;

  @IsOptional()
  @IsString()
  markdownContent?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;
}