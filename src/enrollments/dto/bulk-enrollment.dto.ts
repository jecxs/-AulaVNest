// enrollments/dto/bulk-enrollment.dto.ts
import {
  IsArray,
  IsString,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkEnrollmentUserDto {
  @IsString()
  userEmail: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkEnrollmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkEnrollmentUserDto)
  users: BulkEnrollmentUserDto[];

  @IsString()
  courseId: string;

  @IsOptional()
  @IsBoolean()
  paymentConfirmed?: boolean = false;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
