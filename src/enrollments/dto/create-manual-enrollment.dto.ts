// enrollments/dto/create-manual-enrollment.dto.ts
import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateManualEnrollmentDto {
  @IsString()
  userEmail: string; // Email del usuario a enrollar

  @IsString()
  courseId: string;

  @IsOptional()
  @IsBoolean()
  paymentConfirmed?: boolean = false;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string; // Notas adicionales del admin
}
