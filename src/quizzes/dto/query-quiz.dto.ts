// quizzes/dto/query-quiz.dto.ts
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryQuizzesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

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
  sortBy: string = 'title';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'asc';
}
