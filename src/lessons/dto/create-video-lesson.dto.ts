// lessons/dto/create-video-lesson.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVideoLessonDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  durationSec?: number;

  @IsString()
  moduleId: string;

  // El archivo se manejará como FormData en el controller
}
