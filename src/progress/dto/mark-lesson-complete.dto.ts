// progress/dto/mark-lesson-complete.dto.ts
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkLessonCompleteDto {
  @IsString()
  lessonId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score?: number; // Puntuación opcional
}
