// lessons/dto/query-lessons.dto.ts
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType } from '@prisma/client';

export class QueryLessonsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

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
  sortBy: string = 'order';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'asc';
}
