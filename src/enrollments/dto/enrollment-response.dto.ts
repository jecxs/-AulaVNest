// enrollments/dto/enrollment-response.dto.ts - CORREGIDO
import { Course, CourseCategory, Enrollment, User } from '@prisma/client';

export type EnrollmentWithRelations = Enrollment & {
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'phone'>;
  course?: Pick<
    Course,
    'id' | 'title' | 'slug' | 'price' | 'level' | 'status'
  > & {
    category: Pick<CourseCategory, 'name'>;
  };
  enrolledBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
};

export class EnrollmentResponseDto {
  id: string;
  status: string;
  paymentConfirmed: boolean;
  enrolledAt: Date;
  expiresAt?: Date;
  userId: string;
  courseId: string;
  enrolledById: string;
}

export class EnrollmentWithDetailsDto extends EnrollmentResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null; // 👈 CORREGIDO: Permitir null
  };
  course: {
    id: string;
    title: string;
    slug: string;
    price?: number | null; // 👈 CORREGIDO: Permitir null
    level: string;
    status: string;
    category: {
      name: string;
    };
  };
  enrolledBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  progress?: {
    completedLessons: number;
    totalLessons: number;
    completionPercentage: number;
  };
}

// 👈 CORREGIDO: Tipo para enrollment con progress
export type EnrollmentWithProgress = EnrollmentWithRelations & {
  progress?: {
    completedLessons: number;
    totalLessons: number;
    completionPercentage: number;
  };
};
