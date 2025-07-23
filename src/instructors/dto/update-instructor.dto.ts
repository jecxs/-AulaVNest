// instructors/dto/update-instructor.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateInstructorDto } from './create-instructor.dto';

export class UpdateInstructorDto extends PartialType(CreateInstructorDto) {}

// instructors/dto/instructor-response.dto.ts
export class InstructorResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  bio?: string;
  specialization?: string;
  experience?: string;
  linkedinUrl?: string;
  createdAt: Date;
}

export class InstructorWithCoursesDto extends InstructorResponseDto {
  courses: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    level: string;
    enrollmentCount: number;
  }>;
  _count: {
    courses: number;
  };
}

export class InstructorListDto {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  specialization?: string;
  _count: {
    courses: number;
  };
  createdAt: Date;
}
