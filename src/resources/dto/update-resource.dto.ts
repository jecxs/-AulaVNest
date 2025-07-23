// resources/dto/update-resource.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateResourceDto } from './create-resource.dto';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateResourceDto extends PartialType(CreateResourceDto) {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sizeKb?: number | null; // Consistente con Prisma
}
