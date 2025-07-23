// resources/dto/query-resources.dto.ts
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryResourcesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

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
  sortBy: string = 'fileName';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'asc';
}
