// instructors/dto/create-instructor.dto.ts
import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class CreateInstructorDto {
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  experience?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;
}
