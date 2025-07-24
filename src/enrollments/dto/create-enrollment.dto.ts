// enrollments/dto/create-enrollment.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class CreateEnrollmentDto {
  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  enrolledById: string; // ID del admin que enrolla al usuario

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus = EnrollmentStatus.ACTIVE;

  @IsOptional()
  @IsBoolean()
  paymentConfirmed?: boolean = false;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // Fecha de expiración opcional
}
