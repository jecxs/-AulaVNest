// lessons/dto/create-text-lesson.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTextLessonDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsString()
  markdownContent?: string;

  @IsString()
  moduleId: string;

  // Si hay archivo PDF, se manejará como FormData
}
