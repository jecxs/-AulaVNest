// progress/dto/create-progress.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProgressDto {
  @IsString()
  enrollmentId: string;

  @IsString()
  lessonId: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string; // Fecha cuando se completó

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score?: number; // Puntuación si es aplicable
}
