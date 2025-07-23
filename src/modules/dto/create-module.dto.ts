// modules/dto/create-module.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateModuleDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = true;

  @IsString()
  courseId: string;
}
