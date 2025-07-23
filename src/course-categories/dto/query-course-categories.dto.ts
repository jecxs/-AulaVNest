// course-categories/dto/query-course-categories.dto.ts
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryCourseCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

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
  sortBy: string = 'name';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'asc';
}
