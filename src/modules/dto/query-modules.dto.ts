// modules/dto/query-modules.dto.ts
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryModulesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isRequired?: boolean;

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
