// quizzes/dto/create-quiz.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuizDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  passingScore?: number = 70;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  attemptsAllowed?: number = 3;

  @IsString()
  moduleId: string;
}