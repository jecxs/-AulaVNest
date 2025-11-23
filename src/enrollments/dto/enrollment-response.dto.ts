// enrollments/dto/enrollment-response.dto.ts

import { EnrollmentStatus } from '@prisma/client';

export interface EnrollmentProgress {
  totalLessons: number;

  completedLessons: number;

  completionPercentage: number;
}

export interface EnrollmentWithProgress {
  id: string;

  userId: string;

  courseId: string;

  enrolledById: string;

  status: EnrollmentStatus;

  paymentConfirmed: boolean;

  enrolledAt: Date | string;

  expiresAt?: Date | string | null;

  user: {
    id: string;

    email: string;

    firstName: string;

    lastName: string;

    phone: string | null;
  };

  course: {
    id: string;

    title: string;

    slug: string;

    price: number | null;

    level: string;

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

  progress: EnrollmentProgress;
}
