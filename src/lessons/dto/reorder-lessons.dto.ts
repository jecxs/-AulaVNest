// lessons/dto/reorder-lessons.dto.ts
import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class LessonOrderDto {
  @IsString()
  id: string;

  @IsNumber()
  @Type(() => Number)
  order: number;
}

export class ReorderLessonsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonOrderDto)
  lessons: LessonOrderDto[];
}
