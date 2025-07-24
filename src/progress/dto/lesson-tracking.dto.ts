// progress/dto/lesson-tracking.dto.ts - DTOs OPTIMIZADOS
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class StartLessonDto {
  @IsString()
  lessonId: string;
}

export class VideoProgressDto {
  @IsString()
  lessonId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  progressPercentage: number; // Solo para videos
}

export class LessonViewDto {
  @IsString()
  lessonId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeSpentSeconds?: number; // Tiempo total gastado al salir
}

export class NavigationDto {
  @IsString()
  fromLessonId: string;

  @IsString()
  toLessonId: string;
}
