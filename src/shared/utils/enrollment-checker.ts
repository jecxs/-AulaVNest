// shared/utils/enrollment-checker.ts
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

export class EnrollmentChecker {
  constructor(private prisma: PrismaService) {}

  async verifyUserEnrollment(
    userId: string,
    courseId: string,
    throwOnError: boolean = true,
  ): Promise<{ hasAccess: boolean; enrollment?: any; reason?: string }> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      const result = { hasAccess: false, reason: 'Not enrolled in course' };
      if (throwOnError) {
        throw new ForbiddenException(result.reason);
      }
      return result;
    }

    if (enrollment.status !== 'ACTIVE') {
      const result = {
        hasAccess: false,
        reason: `Enrollment is ${enrollment.status.toLowerCase()}`,
        enrollment,
      };
      if (throwOnError) {
        throw new ForbiddenException(result.reason);
      }
      return result;
    }

    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
      const result = {
        hasAccess: false,
        reason: 'Enrollment has expired',
        enrollment,
      };
      if (throwOnError) {
        throw new ForbiddenException(result.reason);
      }
      return result;
    }

    return { hasAccess: true, enrollment };
  }
}
