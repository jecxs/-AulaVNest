// quizzes/dto/submit-quiz.dto.ts
import {
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitAnswerDto {
  @IsString()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptionIds: string[]; // Array para soportar múltiples respuestas
}

export class SubmitQuizDto {
  @IsString()
  quizId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  @ArrayMinSize(1)
  answers: SubmitAnswerDto[];
}

export class QuizResultDto {
  quizId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: Array<{
    questionId: string;
    selectedOptions: string[];
    correctOptions: string[];
    isCorrect: boolean;
    points: number;
  }>;
  submittedAt: Date;
}