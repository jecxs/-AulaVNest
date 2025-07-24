// enrollments/dto/update-enrollment.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateEnrollmentDto } from './create-enrollment.dto';
import { IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsBoolean()
  paymentConfirmed?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
