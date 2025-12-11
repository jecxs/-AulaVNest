// students/students.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentProfileResponseDto } from './dto/student-profile-response.dto';
import { EnrollmentStatus } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener perfil completo del estudiante con toda su información
   */
  async getStudentProfile(userId: string): Promise<StudentProfileResponseDto> {
    // 1. Obtener información básica del usuario
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Obtener estadísticas de enrollments
    const [
      totalEnrolled,
      activeEnrollments,
      completedCourses,
      expiredEnrollments,
    ] = await Promise.all([
      this.prisma.enrollment.count({
        where: { userId },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: EnrollmentStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: EnrollmentStatus.COMPLETED,
        },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: EnrollmentStatus.EXPIRED,
        },
      }),
    ]);

    // 3. Obtener cursos activos con progreso
    const activeEnrollmentsData = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: {
        course: {
          include: {
            category: {
              select: { name: true },
            },
            instructor: {
              select: { firstName: true, lastName: true },
            },
            modules: {
              include: {
                lessons: {
                  select: { id: true, title: true, order: true },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        progress: {
          include: {
            lesson: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    // 4. Procesar cursos activos con cálculo de progreso
    const activeCourses = activeEnrollmentsData.map((enrollment) => {
      // Contar total de lecciones del curso
      const totalLessons = enrollment.course.modules.reduce(
        (acc, module) => acc + module.lessons.length,
        0,
      );

      // Contar lecciones completadas
      const completedLessons = enrollment.progress.length;

      // Calcular porcentaje de progreso
      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      // Obtener IDs de lecciones completadas
      const completedLessonIds = new Set(
        enrollment.progress.map((p) => p.lesson.id),
      );

      // Encontrar la próxima lección sin completar
      let nextLessonTitle: string | null = null;
      for (const module of enrollment.course.modules) {
        for (const lesson of module.lessons) {
          if (!completedLessonIds.has(lesson.id)) {
            nextLessonTitle = lesson.title;
            break;
          }
        }
        if (nextLessonTitle) break;
      }

      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.course.id,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
        courseThumbnailUrl: enrollment.course.thumbnailUrl,
        categoryName: enrollment.course.category.name,
        instructorName: `${enrollment.course.instructor.firstName} ${enrollment.course.instructor.lastName}`,
        enrolledAt: enrollment.enrolledAt,
        expiresAt: enrollment.expiresAt,
        progressPercentage,
        completedLessons,
        totalLessons,
        nextLessonTitle,
      };
    });

    // 5. Obtener próximas sesiones en vivo
    const now = new Date();
    const courseIds = activeEnrollmentsData.map((e) => e.courseId);

    const upcomingSessions =
      courseIds.length > 0
        ? await this.prisma.liveSession.findMany({
            where: {
              courseId: { in: courseIds },
              startsAt: { gte: now },
            },
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: { startsAt: 'asc' },
            take: 5, // Limitar a las próximas 5 sesiones
          })
        : [];

    // 6. Obtener contador de notificaciones sin leer
    const unreadNotifications = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    // 7. Construir respuesta completa
    return {
      // Información básica
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,

      // Roles
      roles: user.roles.map((userRole) => ({
        id: userRole.role.id,
        name: userRole.role.name,
      })),

      // Estadísticas de cursos
      coursesStats: {
        totalEnrolled,
        activeEnrollments,
        completedCourses,
        expiredEnrollments,
      },

      // Cursos activos con progreso
      activeCourses,

      // Próximas sesiones en vivo
      upcomingSessions: upcomingSessions.map((session) => ({
        id: session.id,
        topic: session.topic,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        meetingUrl: session.meetingUrl,
        courseTitle: session.course.title,
        courseId: session.course.id,
      })),

      // Notificaciones sin leer
      unreadNotifications,
    };
  }

  /**
   * Obtener solo las estadísticas rápidas del estudiante
   */
  async getStudentStats(userId: string) {
    const [
      totalEnrolled,
      activeEnrollments,
      completedCourses,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.enrollment.count({
        where: { userId },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: EnrollmentStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          status: EnrollmentStatus.COMPLETED,
        },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    return {
      totalEnrolled,
      activeEnrollments,
      completedCourses,
      unreadNotifications,
    };
  }
}
