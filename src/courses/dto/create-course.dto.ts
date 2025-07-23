// courses/dto/create-course.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDecimal,
  Min,
  MaxLength,
} from 'class-validator';
import { CourseLevel, CourseStatus, CourseVisibility } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateCourseDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel = CourseLevel.BEGINNER;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsEnum(CourseVisibility)
  visibility?: CourseVisibility = CourseVisibility.PRIVATE;

  @IsString()
  categoryId: string;

  @IsString()
  instructorId: string;
}
