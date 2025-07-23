import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
