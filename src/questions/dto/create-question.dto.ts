// questions/dto/create-question.dto.ts
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  MaxLength,
  Max,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '@prisma/client';

export class CreateAnswerOptionDto {
  @IsString()
  @MaxLength(500)
  text: string;

  @IsOptional()
  isCorrect?: boolean = false;
}

export class CreateQuestionDto {
  @IsString()
  @MaxLength(1000)
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  weight?: number = 1;

  @IsOptional()
  @IsUrl()
  imageUrl?: string; // 👈 NUEVO: URL de la imagen

  @IsString()
  quizId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  @ArrayMinSize(2)
  answerOptions: CreateAnswerOptionDto[];
}

export class CreateQuestionSimpleDto {
  @IsString()
  @MaxLength(1000)
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  weight?: number = 1;

  @IsOptional()
  @IsUrl()
  imageUrl?: string; // 👈 NUEVO: URL de la imagen

  @IsString()
  quizId: string;
}

// 👈 NUEVO: DTO específico para subir pregunta con imagen
export class CreateQuestionWithImageDto {
  @IsString()
  @MaxLength(1000)
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  weight?: number = 1;

  @IsString()
  quizId: string;

  @IsOptional()
  @IsString()
  answerOptionsJson?: string; // JSON string de las opciones cuando se sube archivo
}
