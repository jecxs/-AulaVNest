// resources/dto/create-resource.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResourceDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  fileType: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sizeKb?: number | null; // Permitir null también

  @IsString()
  lessonId: string;
}

// DTO para subida de archivos
export class UploadResourceDto {
  @IsString()
  lessonId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customFileName?: string;
}
