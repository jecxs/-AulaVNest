// progress/progress.service.ts - SIMPLIFICADO
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Progress, RoleName } from '@prisma/client';
import { CreateProgressDto } from './dto/create-progress.dto';
import { MarkLessonCompleteDto } from './dto/mark-lesson-complete.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ========== CORE: MARCAR LECCIÓN COMO COMPLETADA (ESTUDIANTES) ==========

  /**
   * Marcar lección como completada - ENDPOINT PRINCIPAL
   * Este es el método que el frontend llama cuando el estudiante hace click en "Completar y Continuar"
   */
  async markLessonComplete(
    userId: string,
    markLessonCompleteDto: MarkLessonCompleteDto,
  ) {
    const { lessonId, score } = markLessonCompleteDto;

    // Verificar lesson y obtener información completa
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true },
            },
          },
        },
        progress: {
          where: {
            enrollment: { userId },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Verificar enrollment activo
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.module.courseId,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not have access to this lesson');
    }

    // Verificar si ya está completada (idempotente)
    const existingProgress = lesson.progress[0];
    if (existingProgress?.completedAt) {
      return {
        message: 'Lesson already completed',
        alreadyCompleted: true,
        progress: existingProgress,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        completedAt: existingProgress.completedAt,
      };
    }

    try {
      // Crear o actualizar progress
      const progressRecord = await this.prisma.progress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: enrollment.id,
            lessonId,
          },
        },
        update: {
          completedAt: new Date(),
          ...(score !== undefined && { score }),
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          completedAt: new Date(),
          ...(score !== undefined && { score }),
        },
      });

      // Verificar y emitir notificaciones
      await this.checkAndEmitNotifications(userId, lesson, enrollment.id);

      return {
        message: 'Lesson completed successfully',
        progress: progressRecord,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        completedAt: progressRecord.completedAt,
      };
    } catch (error) {
      throw new BadRequestException('Failed to mark lesson as complete');
    }
  }

  /**
   * Verificar y emitir notificaciones de módulo/curso completado
   */
  private async checkAndEmitNotifications(
    userId: string,
    lesson: any,
    enrollmentId: string,
  ) {
    try {
      // 1. Verificar si se completó el módulo
      const moduleCompletion = await this.checkModuleCompletion(
        enrollmentId,
        lesson.moduleId,
      );

      if (moduleCompletion.isCompleted) {
        await this.notificationsService.createModuleCompletedNotification(
          userId,
          {
            title: lesson.module.title,
            courseName: lesson.module.course.title,
            courseId: lesson.module.courseId,
            moduleId: lesson.moduleId,
          },
        );
      }

      // 2. Verificar si se completó todo el curso
      const courseCompletion = await this.checkCourseCompletion(
        enrollmentId,
        lesson.module.courseId,
      );

      if (courseCompletion.isCompleted) {
        await this.notificationsService.createCourseCompletedNotification(
          userId,
          {
            title: lesson.module.course.title,
            id: lesson.module.courseId,
          },
        );
      }
    } catch (error) {
      // No fallar el progreso por errores en notificaciones
      console.error('Error emitting progress notifications:', error);
    }
  }

  /**
   * Verificar si un módulo está completo
   */
  private async checkModuleCompletion(enrollmentId: string, moduleId: string) {
    const totalLessons = await this.prisma.lesson.count({
      where: { moduleId },
    });

    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollmentId,
        lesson: { moduleId },
        completedAt: { not: null },
      },
    });

    return {
      isCompleted: completedLessons === totalLessons && totalLessons > 0,
      totalLessons,
      completedLessons,
      percentage:
        totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
    };
  }

  /**
   * Verificar si un curso está completo
   */
  private async checkCourseCompletion(enrollmentId: string, courseId: string) {
    const totalLessons = await this.prisma.lesson.count({
      where: { module: { courseId } },
    });

    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollmentId,
        lesson: { module: { courseId } },
        completedAt: { not: null },
      },
    });

    return {
      isCompleted: completedLessons === totalLessons && totalLessons > 0,
      totalLessons,
      completedLessons,
      percentage:
        totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
    };
  }

  // ========== CONSULTAS DE PROGRESO (ESTUDIANTES) ==========

  /**
   * Obtener resumen de progreso del usuario
   */
  async getUserProgressSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        progress: {
          where: { completedAt: { not: null } },
        },
      },
    });

    const totalEnrollments = enrollments.length;
    let totalLessonsCompleted = 0;
    let totalScores: number[] = [];

    const courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const courseProgress = await this.calculateCourseProgress(
          userId,
          enrollment.courseId,
        );

        totalLessonsCompleted += courseProgress.completedLessons;

        // Recopilar scores
        const progressWithScores = await this.prisma.progress.findMany({
          where: {
            enrollmentId: enrollment.id,
            score: { not: null },
          },
          select: { score: true },
        });

        progressWithScores.forEach((p) => {
          if (p.score !== null) totalScores.push(p.score);
        });

        // Última actividad
        const lastActivity = await this.prisma.progress.findFirst({
          where: { enrollmentId: enrollment.id },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        });

        return {
          courseId: enrollment.courseId,
          courseTitle: enrollment.course.title,
          completionPercentage: courseProgress.completionPercentage,
          lastActivity: lastActivity?.completedAt,
        };
      }),
    );

    const totalCoursesCompleted = courses.filter(
      (course) => course.completionPercentage === 100,
    ).length;

    const averageScore =
      totalScores.length > 0
        ? Math.round(
            (totalScores.reduce((sum, score) => sum + score, 0) /
              totalScores.length) *
              100,
          ) / 100
        : undefined;

    return {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      totalEnrollments,
      totalCoursesCompleted,
      totalLessonsCompleted,
      averageScore,
      courses,
    };
  }

  /**
   * Obtener progreso del usuario en un curso específico
   */
  async getUserCourseProgress(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    if (enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('Enrollment is not active');
    }

    const courseProgress = await this.calculateCourseProgress(userId, courseId);

    const modules = await this.prisma.module.findMany({
      where: { courseId },
      include: {
        lessons: {
          include: {
            progress: {
              where: { enrollmentId: enrollment.id },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const moduleProgress = modules.map((module) => {
      const lessons = module.lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        type: lesson.type,
        order: lesson.order,
        isCompleted:
          lesson.progress.length > 0 && lesson.progress[0].completedAt !== null,
        completedAt: lesson.progress[0]?.completedAt,
        score: lesson.progress[0]?.score,
      }));

      const completedLessons = lessons.filter((l) => l.isCompleted).length;
      const moduleCompletionPercentage =
        lessons.length > 0
          ? Math.round((completedLessons / lessons.length) * 100)
          : 0;

      return {
        moduleId: module.id,
        title: module.title,
        order: module.order,
        totalLessons: lessons.length,
        completedLessons,
        completionPercentage: moduleCompletionPercentage,
        lessons,
      };
    });

    return {
      courseId,
      userId,
      enrollment: {
        id: enrollment.id,
        enrolledAt: enrollment.enrolledAt,
        expiresAt: enrollment.expiresAt,
        status: enrollment.status,
      },
      overall: courseProgress,
      modules: moduleProgress,
    };
  }

  /**
   * Verificar si una lesson está completada
   */
  async checkLessonProgress(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                enrollments: {
                  where: {
                    userId,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
        progress: {
          where: {
            enrollment: {
              userId,
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const enrollment = lesson.module.course.enrollments[0];
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    const progress = lesson.progress[0];

    // 🐛 FIX: Verificar correctamente si existe progreso completado
    const isCompleted = Boolean(progress && progress.completedAt !== null);

    return {
      lessonId: lesson.id,
      title: lesson.title,
      isCompleted, // ✅ Ahora devuelve false correctamente cuando no hay progreso
      completedAt: progress?.completedAt,
      score: progress?.score,
      canAccess: true,
      enrollmentId: enrollment.id,
    };
  }

  /**
   * Obtener siguiente lesson por completar
   */
  async getNextLessonToComplete(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not have access to this course');
    }

    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: { courseId },
      },
      include: {
        module: {
          select: { id: true, title: true, order: true },
        },
        progress: {
          where: { enrollmentId: enrollment.id },
        },
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    });

    const nextLesson = lessons.find(
      (lesson) =>
        lesson.progress.length === 0 || lesson.progress[0].completedAt === null,
    );

    if (!nextLesson) {
      return {
        message: 'All lessons completed!',
        courseCompleted: true,
        nextLesson: null,
      };
    }

    return {
      message: 'Next lesson to complete',
      courseCompleted: false,
      nextLesson: {
        id: nextLesson.id,
        title: nextLesson.title,
        type: nextLesson.type,
        order: nextLesson.order,
        module: nextLesson.module,
      },
    };
  }

  /**
   * Obtener progreso detallado de un módulo específico
   */
  async getModuleProgress(userId: string, moduleId: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { userId, status: 'ACTIVE' },
            },
          },
        },
        lessons: {
          include: {
            progress: {
              where: {
                enrollment: { userId },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const enrollment = module.course.enrollments[0];
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    const lessons = module.lessons.map((lesson) => {
      const progress = lesson.progress[0];
      return {
        lessonId: lesson.id,
        title: lesson.title,
        type: lesson.type,
        order: lesson.order,
        durationSec: lesson.durationSec,
        isCompleted: progress?.completedAt !== null,
        completedAt: progress?.completedAt,
        score: progress?.score,
      };
    });

    const completedLessons = lessons.filter((l) => l.isCompleted).length;
    const completionPercentage =
      lessons.length > 0
        ? Math.round((completedLessons / lessons.length) * 100)
        : 0;

    return {
      moduleId: module.id,
      title: module.title,
      order: module.order,
      totalLessons: lessons.length,
      completedLessons,
      completionPercentage,
      lessons,
    };
  }

  /**
   * Calcular progreso de un curso (helper privado)
   */
  private async calculateCourseProgress(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const totalLessons = await this.prisma.lesson.count({
      where: {
        module: { courseId },
      },
    });

    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollmentId: enrollment.id,
        completedAt: { not: null },
      },
    });

    const completionPercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    const avgScoreResult = await this.prisma.progress.aggregate({
      where: {
        enrollmentId: enrollment.id,
        score: { not: null },
      },
      _avg: { score: true },
    });

    return {
      totalLessons,
      completedLessons,
      completionPercentage,
      averageScore: avgScoreResult._avg.score,
    };
  }

  // ========== ADMIN: GESTIÓN DE PROGRESO (CORRECCIONES) ==========

  /**
   * Crear progress directo (solo admin, para correcciones)
   */
  async create(createProgressDto: CreateProgressDto): Promise<Progress> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: createProgressDto.enrollmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { id: true, title: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: createProgressDto.lessonId },
      include: {
        module: {
          select: { courseId: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.module.courseId !== enrollment.courseId) {
      throw new BadRequestException(
        'Lesson does not belong to the enrolled course',
      );
    }

    const existingProgress = await this.prisma.progress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: createProgressDto.enrollmentId,
          lessonId: createProgressDto.lessonId,
        },
      },
    });

    if (existingProgress) {
      throw new BadRequestException(
        'Progress already exists for this lesson and enrollment',
      );
    }

    return await this.prisma.progress.create({
      data: {
        ...createProgressDto,
        completedAt: createProgressDto.completedAt
          ? new Date(createProgressDto.completedAt)
          : new Date(),
      },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: { id: true, title: true },
            },
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            durationSec: true,
            module: {
              select: { id: true, title: true, order: true },
            },
          },
        },
      },
    });
  }

  /**
   * Obtener progress por ID
   */
  async findOne(id: string): Promise<Progress> {
    const progress = await this.prisma.progress.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: { id: true, title: true },
            },
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            durationSec: true,
            module: {
              select: { id: true, title: true, order: true },
            },
          },
        },
      },
    });

    if (!progress) {
      throw new NotFoundException(`Progress with ID ${id} not found`);
    }

    return progress;
  }

  /**
   * Obtener enrollment de un progress (helper para verificaciones de acceso)
   */
  async getProgressEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, courseId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    return enrollment;
  }

  /**
   * Marcar lesson como no completada (admin, para correcciones)
   */
  async markLessonIncomplete(id: string): Promise<Progress> {
    await this.findOne(id);

    return await this.prisma.progress.update({
      where: { id },
      data: {
        completedAt: null,
        score: null,
      },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: { id: true, title: true },
            },
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            module: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });
  }

  /**
   * Resetear progreso de un curso (admin, para correcciones)
   */
  async resetCourseProgress(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const deletedProgress = await this.prisma.progress.deleteMany({
      where: { enrollmentId: enrollment.id },
    });

    return {
      message: 'Course progress reset successfully',
      deletedRecords: deletedProgress.count,
      enrollmentId: enrollment.id,
      courseId,
      userId,
    };
  }

  /**
   * Resetear progreso de una lesson (admin, para correcciones)
   */
  async resetLessonProgress(userId: string, lessonId: string) {
    const progress = await this.prisma.progress.findFirst({
      where: {
        lessonId,
        enrollment: { userId },
      },
      include: {
        enrollment: { select: { courseId: true } },
        lesson: { select: { title: true } },
      },
    });

    if (!progress) {
      throw new NotFoundException(
        'Progress not found for this lesson and user',
      );
    }

    await this.prisma.progress.delete({
      where: { id: progress.id },
    });

    return {
      message: 'Lesson progress reset successfully',
      lessonId,
      lessonTitle: progress.lesson.title,
      userId,
      courseId: progress.enrollment.courseId,
    };
  }

  /**
   * Eliminar progress (admin, para correcciones)
   */
  async remove(id: string): Promise<Progress> {
    const progress = await this.findOne(id);

    return await this.prisma.progress.delete({
      where: { id },
    });
  }
}
