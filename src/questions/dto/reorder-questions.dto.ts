// questions/dto/reorder-questions.dto.ts
import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionOrderDto {
  @IsString()
  id: string;

  @IsNumber()
  @Type(() => Number)
  order: number;
}

export class ReorderQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOrderDto)
  questions: QuestionOrderDto[];
}
