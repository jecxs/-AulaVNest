// courses/dto/query-courses.dto.ts
import { IsOptional, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CourseLevel, CourseStatus, CourseVisibility } from '@prisma/client';

export class QueryCoursesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsEnum(CourseVisibility)
  visibility?: CourseVisibility;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  instructorId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit: number = 10;

  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'desc';
}
