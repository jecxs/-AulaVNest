// course-categories/dto/create-course-category.dto.ts
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateCourseCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
