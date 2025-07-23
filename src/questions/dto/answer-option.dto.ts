// questions/dto/answer-option.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateAnswerOptionSimpleDto {
  @IsString()
  @MaxLength(500)
  text: string;

  @IsOptional()
  isCorrect?: boolean = false;

  @IsString()
  questionId: string;
}

export class UpdateAnswerOptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  @IsOptional()
  isCorrect?: boolean;
}
