// questions/dto/update-question.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionSimpleDto } from './create-question.dto';

export class UpdateQuestionDto extends PartialType(CreateQuestionSimpleDto) {}