// progress/progress.service.ts - CORREGIDO
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Progress, LessonType, Prisma, RoleName } from '@prisma/client';
import { CreateProgressDto } from './dto/create-progress.dto';
import { MarkLessonCompleteDto } from './dto/mark-lesson-complete.dto';
import { BulkProgressDto } from './dto/bulk-progress.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { QueryProgressDto } from './dto/query-progress.dto';
import { LessonViewDto, VideoProgressDto } from './dto/lesson-tracking.dto';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ========== PROGRESS CREATION ==========


  // Obtener estadísticas de auto-completado
  async getAutoCompletionStats(courseId?: string) {
    const whereClause = courseId
      ? {
          enrollment: { courseId },
        }
      : {};

    const [totalProgress, manualCompletions, autoCompletions] =
      await Promise.all([
        this.prisma.progress.count({
          where: {
            ...whereClause,
            completedAt: { not: null },
          },
        }),

        // Progreso marcado manualmente (con score o en horario de clases)
        this.prisma.progress.count({
          where: {
            ...whereClause,
            completedAt: { not: null },
            OR: [
              { score: { not: null } }, // Quiz/evaluaciones
              // Aquí podrías agregar más criterios para "manual"
            ],
          },
        }),

        // Progreso auto-completado (sin score, fuera de horario, etc.)
        this.prisma.progress.count({
          where: {
            ...whereClause,
            completedAt: { not: null },
            score: null,
          },
        }),
      ]);

    return {
      total: totalProgress,
      manual: manualCompletions,
      automatic: autoCompletions,
      manualPercentage:
        totalProgress > 0
          ? Math.round((manualCompletions / totalProgress) * 100)
          : 0,
      automaticPercentage:
        totalProgress > 0
          ? Math.round((autoCompletions / totalProgress) * 100)
          : 0,
    };
  }

  // Crear progress directo
  async create(createProgressDto: CreateProgressDto): Promise<Progress> {
    // Verificar que el enrollment existe
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

    // Verificar que la lesson existe
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

    // Verificar que la lesson pertenece al curso del enrollment
    if (lesson.module.courseId !== enrollment.courseId) {
      throw new BadRequestException(
        'Lesson does not belong to the enrolled course',
      );
    }

    // Verificar que no existe progreso para esta combinación
    const existingProgress = await this.prisma.progress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: createProgressDto.enrollmentId,
          lessonId: createProgressDto.lessonId,
        },
      },
    });

    if (existingProgress) {
      throw new ConflictException(
        'Progress already exists for this lesson and enrollment',
      );
    }

    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Progress already exists for this lesson and enrollment',
          );
        }
      }
      throw error;
    }
  }

  // Marcar lesson como completada (para estudiantes)
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

    // Verificar si ya está completada
    const existingProgress = lesson.progress[0];
    if (existingProgress?.completedAt) {
      return {
        message: 'Lesson already completed',
        alreadyCompleted: true,
        progress: existingProgress,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        completedAt: existingProgress.completedAt, // ← AGREGAR AQUÍ
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
          ...(score && { score }),
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId,
          completedAt: new Date(),
          ...(score && { score }),
        },
      });

      // 🔔 VERIFICAR Y EMITIR NOTIFICACIONES
      await this.checkAndEmitNotifications(userId, lesson, enrollment.id);

      return {
        message: 'Lesson completed successfully',
        progress: progressRecord,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        courseTitle: lesson.module.course.title,
        completedAt: progressRecord.completedAt, // ← USAR progressRecord EN LUGAR DE progress
      };
    } catch (error) {
      throw new BadRequestException('Failed to mark lesson as complete');
    }
  }

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
        // 📧 Notificar módulo completado
        await this.notificationsService.createModuleCompletedNotification(
          userId,
          {
            title: lesson.module.title,
            courseName: lesson.module.course.title,
            courseId: lesson.module.courseId,
            moduleId: lesson.moduleId,
          },
        );

        console.log(
          `📧 Module completion notification sent for user ${userId}`,
        );
      }

      // 2. Verificar si se completó todo el curso
      const courseCompletion = await this.checkCourseCompletion(
        enrollmentId,
        lesson.module.courseId,
      );

      if (courseCompletion.isCompleted) {
        // 🎉 Notificar curso completado
        await this.notificationsService.createCourseCompletedNotification(
          userId,
          {
            title: lesson.module.course.title,
            id: lesson.module.courseId,
          },
        );

        console.log(
          `🎉 Course completion notification sent for user ${userId}`,
        );
      }
    } catch (error) {
      // No fallar el progreso por errores en notificaciones
      console.error('Error emitting progress notifications:', error);
    }
  }
  // Verificar si un módulo está completo
  private async checkModuleCompletion(enrollmentId: string, moduleId: string) {
    // Total de lessons en el módulo
    const totalLessons = await this.prisma.lesson.count({
      where: { moduleId },
    });

    // Lessons completadas del módulo
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

  // Verificar si un curso está completo
  private async checkCourseCompletion(enrollmentId: string, courseId: string) {
    // Total de lessons en el curso
    const totalLessons = await this.prisma.lesson.count({
      where: {
        module: { courseId },
      },
    });

    // Lessons completadas del curso
    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollmentId,
        lesson: {
          module: { courseId },
        },
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

  // Marcar múltiples lessons como completadas (bulk)
  async bulkMarkComplete(bulkProgressDto: BulkProgressDto): Promise<{
    successful: Progress[];
    failed: Array<{ lessonId: string; error: string }>;
    summary: { total: number; successful: number; failed: number };
  }> {
    const successful: Progress[] = [];
    const failed: Array<{ lessonId: string; error: string }> = [];

    // Verificar que el enrollment existe
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: bulkProgressDto.enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    for (const lessonInfo of bulkProgressDto.lessons) {
      try {
        const progress = await this.create({
          enrollmentId: bulkProgressDto.enrollmentId,
          lessonId: lessonInfo.lessonId,
          completedAt: new Date().toISOString(),
        });
        successful.push(progress);
      } catch (error) {
        failed.push({
          lessonId: lessonInfo.lessonId,
          error: error.message,
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: bulkProgressDto.lessons.length,
        successful: successful.length,
        failed: failed.length,
      },
    };
  }

  // ========== PROGRESS QUERIES ==========

  // Obtener todos los progress con filtros
  async findAll(query: QueryProgressDto) {
    const {
      page = 1,
      limit = 10,
      enrollmentId,
      lessonId,
      userId,
      courseId,
      moduleId,
      completed,
      sortBy = 'completedAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Prisma.ProgressWhereInput = {
      ...(enrollmentId && { enrollmentId }),
      ...(lessonId && { lessonId }),
      ...(userId && { enrollment: { userId } }),
      ...(courseId && { enrollment: { courseId } }),
      ...(moduleId && { lesson: { moduleId } }),
      ...(completed === true && { completedAt: { not: null } }),
      ...(completed === false && { completedAt: null }),
    };

    // Crear orderBy
    const orderBy: Prisma.ProgressOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.ProgressOrderByWithRelationInput] =
      sortOrder;

    const [progressList, total] = await Promise.all([
      this.prisma.progress.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
      this.prisma.progress.count({ where }),
    ]);

    return {
      data: progressList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener progress de un usuario
  async getUserProgress(userId: string, query: QueryProgressDto) {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.findAll({ ...query, userId });
  }

  // Obtener progress de un curso
  async getCourseProgress(courseId: string, query: QueryProgressDto) {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.findAll({ ...query, courseId });
  }

  // ========== PROGRESS INDIVIDUAL OPERATIONS ==========

  // Obtener progress por ID
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

  // ← NUEVO MÉTODO: Obtener enrollment de un progress para verificaciones de acceso
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

  // Actualizar progress
  async update(
    id: string,
    updateProgressDto: UpdateProgressDto,
  ): Promise<Progress> {
    // Verificar que el progress existe
    await this.findOne(id);

    try {
      return await this.prisma.progress.update({
        where: { id },
        data: {
          ...updateProgressDto,
          ...(updateProgressDto.completedAt && {
            completedAt: new Date(updateProgressDto.completedAt),
          }),
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
    } catch (error) {
      throw new BadRequestException('Failed to update progress');
    }
  }

  // Marcar lesson como no completada
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

  // ========== PROGRESS SUMMARIES AND ANALYTICS ==========

  // Obtener resumen de progreso del usuario
  async getUserProgressSummary(userId: string) {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Obtener enrollments activos del usuario
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
        // Calcular progreso del curso
        const courseProgress = await this.calculateCourseProgress(
          userId,
          enrollment.courseId,
        );

        totalLessonsCompleted += courseProgress.completedLessons;

        // Recopilar scores para promedio
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

        // Obtener última actividad
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

    // Calcular cursos completados (100% completados)
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

  // Obtener resumen de progreso de un curso
  async getCourseProgressSummary(courseId: string) {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Obtener todas las lessons del curso
    const totalLessons = await this.prisma.lesson.count({
      where: {
        module: { courseId },
      },
    });

    // Obtener enrollments activos
    const activeEnrollments = await this.prisma.enrollment.count({
      where: {
        courseId,
        status: 'ACTIVE',
      },
    });

    // Obtener lessons completadas
    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollment: { courseId },
        completedAt: { not: null },
      },
    });

    const completionPercentage =
      totalLessons > 0 && activeEnrollments > 0
        ? Math.round(
            (completedLessons / (totalLessons * activeEnrollments)) * 100,
          )
        : 0;

    // Calcular score promedio
    const avgScoreResult = await this.prisma.progress.aggregate({
      where: {
        enrollment: { courseId },
        score: { not: null },
      },
      _avg: { score: true },
    });

    // Obtener progreso por módulos
    const modules = await this.prisma.module.findMany({
      where: { courseId },
      include: {
        lessons: {
          include: {
            progress: {
              where: { completedAt: { not: null } },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    const moduleProgress = modules.map((module) => {
      const moduleTotalLessons = module.lessons.length;
      const moduleCompletedLessons = module.lessons.reduce(
        (sum, lesson) => sum + lesson.progress.length,
        0,
      );

      const moduleCompletionPercentage =
        moduleTotalLessons > 0 && activeEnrollments > 0
          ? Math.round(
              (moduleCompletedLessons /
                (moduleTotalLessons * activeEnrollments)) *
                100,
            )
          : 0;

      return {
        moduleId: module.id,
        moduleTitle: module.title,
        totalLessons: moduleTotalLessons,
        completedLessons: moduleCompletedLessons,
        completionPercentage: moduleCompletionPercentage,
      };
    });

    // Última actividad
    const lastActivity = await this.prisma.progress.findFirst({
      where: {
        enrollment: { courseId },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    return {
      courseId: course.id,
      courseTitle: course.title,
      totalLessons,
      completedLessons,
      completionPercentage,
      averageScore: avgScoreResult._avg.score,
      lastActivity: lastActivity?.completedAt,
      modules: moduleProgress,
    };
  }

  // Obtener progreso del usuario en un curso específico
  async getUserCourseProgress(userId: string, courseId: string) {
    // Verificar enrollment activo
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

    // Obtener progreso detallado
    const courseProgress = await this.calculateCourseProgress(userId, courseId);

    // Obtener progreso por módulos
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

  // ========== PROGRESS VERIFICATION AND UTILITIES ==========

  // Verificar si una lesson está completada
  async checkLessonProgress(userId: string, lessonId: string) {
    // Buscar enrollment y progress
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

    return {
      lessonId: lesson.id,
      title: lesson.title,
      isCompleted: progress?.completedAt !== null,
      completedAt: progress?.completedAt,
      score: progress?.score,
      canAccess: true,
      enrollmentId: enrollment.id,
    };
  }

  // Obtener siguiente lesson por completar
  async getNextLessonToComplete(userId: string, courseId: string) {
    // Verificar enrollment
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

    // Obtener todas las lessons del curso ordenadas
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

    // Encontrar la primera lesson no completada
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

  // Calcular progreso de un curso
  private async calculateCourseProgress(userId: string, courseId: string) {
    // Obtener enrollment
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

    // Obtener total de lessons del curso
    const totalLessons = await this.prisma.lesson.count({
      where: {
        module: { courseId },
      },
    });

    // Obtener lessons completadas
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

    // Calcular score promedio
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

  // ========== PROGRESS ANALYTICS ==========

  // Obtener estadísticas generales de progress
  async getProgressStats() {
    const [
      totalProgress,
      completedLessons,
      totalLessons,
      averageCompletionRate,
      recentActivity,
    ] = await Promise.all([
      this.prisma.progress.count(),
      this.prisma.progress.count({
        where: { completedAt: { not: null } },
      }),
      this.prisma.lesson.count(),
      // Calcular tasa de finalización promedio
      this.calculateAverageCompletionRate(),
      // Actividad reciente (últimos 7 días)
      this.prisma.progress.count({
        where: {
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const globalCompletionRate =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    return {
      totalProgress,
      completedLessons,
      totalLessons,
      globalCompletionRate,
      averageCompletionRate,
      recentActivity: {
        last7Days: recentActivity,
      },
    };
  }

  // Obtener tasas de finalización por curso
  async getCompletionRatesByourse() {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    const courseStats = await Promise.all(
      courses.map(async (course) => {
        const totalLessons = await this.prisma.lesson.count({
          where: { module: { courseId: course.id } },
        });

        const completedLessons = await this.prisma.progress.count({
          where: {
            enrollment: { courseId: course.id },
            completedAt: { not: null },
          },
        });

        const activeEnrollments = course._count.enrollments;
        const expectedCompletions = totalLessons * activeEnrollments;

        const completionRate =
          expectedCompletions > 0
            ? Math.round((completedLessons / expectedCompletions) * 100)
            : 0;

        return {
          courseId: course.id,
          courseTitle: course.title,
          totalLessons,
          activeEnrollments,
          completedLessons,
          expectedCompletions,
          completionRate,
        };
      }),
    );

    return courseStats.sort((a, b) => b.completionRate - a.completionRate);
  }

  // Análisis de rendimiento de estudiantes
  async getStudentPerformanceAnalytics(courseId?: string) {
    const whereClause = courseId ? { enrollment: { courseId } } : {};

    // Obtener estadísticas de puntuaciones
    const scoreStats = await this.prisma.progress.aggregate({
      where: {
        ...whereClause,
        score: { not: null },
      },
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true },
      _count: { score: true },
    });

    // Distribución de puntuaciones
    const scoreDistribution = await this.prisma.progress.groupBy({
      by: ['score'],
      where: {
        ...whereClause,
        score: { not: null },
      },
      _count: { score: true },
      orderBy: { score: 'asc' },
    });

    // Top estudiantes por rendimiento
    const topStudents = await this.prisma.enrollment.findMany({
      where: courseId ? { courseId } : {},
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        progress: {
          where: { completedAt: { not: null } },
        },
      },
      take: 10,
    });

    const studentPerformance = topStudents
      .map((enrollment) => {
        const completedLessons = enrollment.progress.length;
        const totalScore = enrollment.progress.reduce(
          (sum, p) => sum + (p.score || 0),
          0,
        );
        const averageScore =
          enrollment.progress.filter((p) => p.score !== null).length > 0
            ? totalScore /
              enrollment.progress.filter((p) => p.score !== null).length
            : 0;

        return {
          userId: enrollment.user.id,
          userName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
          email: enrollment.user.email,
          completedLessons,
          averageScore: Math.round(averageScore * 100) / 100,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);

    return {
      scoreStatistics: {
        averageScore: scoreStats._avg.score,
        minScore: scoreStats._min.score,
        maxScore: scoreStats._max.score,
        totalScores: scoreStats._count.score,
      },
      scoreDistribution: scoreDistribution.map((item) => ({
        score: item.score,
        count: item._count.score,
      })),
      topStudents: studentPerformance,
    };
  }

  // Análisis de dificultad de lessons
  async getLessonDifficultyAnalysis(courseId?: string) {
    const whereClause = courseId ? { module: { courseId } } : {};

    const lessons = await this.prisma.lesson.findMany({
      where: whereClause,
      include: {
        module: {
          select: { id: true, title: true, courseId: true },
        },
        progress: {
          where: { completedAt: { not: null } },
        },
        _count: {
          select: {
            progress: true, // Total progress records (completed + incomplete)
          },
        },
      },
    });

    const lessonAnalysis = lessons
      .map((lesson) => {
        const totalAttempts = lesson._count.progress;
        const completedAttempts = lesson.progress.length;
        const completionRate =
          totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;

        const scores = lesson.progress
          .map((p) => p.score)
          .filter((score) => score !== null);
        const averageScore =
          scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        // Determinar dificultad basada en tasa de finalización y score promedio
        let difficulty = 'Medium';
        if (
          completionRate < 50 ||
          (averageScore !== null && averageScore < 60)
        ) {
          difficulty = 'Hard';
        } else if (
          completionRate > 80 &&
          (averageScore === null || averageScore > 85)
        ) {
          difficulty = 'Easy';
        }

        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonType: lesson.type,
          moduleTitle: lesson.module.title,
          totalAttempts,
          completedAttempts,
          completionRate: Math.round(completionRate),
          averageScore: averageScore
            ? Math.round(averageScore * 100) / 100
            : null,
          difficulty,
        };
      })
      .sort((a, b) => a.completionRate - b.completionRate); // Más difíciles primero

    return {
      lessonsAnalysis: lessonAnalysis,
      summary: {
        totalLessons: lessons.length,
        hardLessons: lessonAnalysis.filter((l) => l.difficulty === 'Hard')
          .length,
        mediumLessons: lessonAnalysis.filter((l) => l.difficulty === 'Medium')
          .length,
        easyLessons: lessonAnalysis.filter((l) => l.difficulty === 'Easy')
          .length,
      },
    };
  }

  // Obtener estadísticas de progress de una lesson específica
  async getLessonProgressStats(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
        progress: {
          include: {
            enrollment: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Calcular estadísticas
    const totalStudents = await this.prisma.enrollment.count({
      where: {
        courseId: lesson.module.course.id,
        status: 'ACTIVE',
      },
    });

    const completedStudents = lesson.progress.filter(
      (p) => p.completedAt !== null,
    ).length;

    const completionRate =
      totalStudents > 0
        ? Math.round((completedStudents / totalStudents) * 100)
        : 0;

    const scores = lesson.progress
      .map((p) => p.score)
      .filter((score) => score !== null);
    const averageScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((sum, score) => sum + score, 0) / scores.length) *
              100,
          ) / 100
        : undefined;

    const studentsWithProgress = lesson.progress.map((progress) => ({
      userId: progress.enrollment.user.id,
      userName: `${progress.enrollment.user.firstName} ${progress.enrollment.user.lastName}`,
      email: progress.enrollment.user.email,
      completedAt: progress.completedAt,
      score: progress.score,
    }));

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonType: lesson.type,
      course: lesson.module.course,
      module: {
        id: lesson.module.id,
        title: lesson.module.title,
      },
      totalStudents,
      completedStudents,
      completionRate,
      averageScore,
      studentsWithProgress,
    };
  }

  // ========== PROGRESS MANAGEMENT ==========

  // Resetear progreso de un curso
  async resetCourseProgress(userId: string, courseId: string) {
    // Verificar enrollment
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

    // Eliminar todo el progreso del curso
    const deletedProgress = await this.prisma.progress.deleteMany({
      where: { enrollmentId: enrollment.id },
    });

    return {
      message: `Course progress reset successfully`,
      deletedRecords: deletedProgress.count,
      enrollmentId: enrollment.id,
      courseId,
      userId,
    };
  }

  // Resetear progreso de una lesson
  async resetLessonProgress(userId: string, lessonId: string) {
    // Buscar el progreso específico
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

    // Eliminar el progreso
    await this.prisma.progress.delete({
      where: { id: progress.id },
    });

    return {
      message: `Lesson progress reset successfully`,
      lessonId,
      lessonTitle: progress.lesson.title,
      userId,
      courseId: progress.enrollment.courseId,
    };
  }



  // Obtener progreso de enrollment específico - ← CORREGIDO
  async getEnrollmentProgress(enrollmentId: string, user: any) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: { select: { id: true } },
        course: { select: { id: true, title: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verificar acceso
    if (
      !user.roles.includes(RoleName.ADMIN) &&
      enrollment.user.id !== user.id
    ) {
      throw new ForbiddenException(
        'You can only view your own enrollment progress',
      );
    }

    // ← CORREGIDO: Incluir sortBy y sortOrder requeridos
    return this.findAll({
      enrollmentId,
      page: 1,
      limit: 100, // Obtener todo el progreso del enrollment
      sortBy: 'completedAt',
      sortOrder: 'desc',
    });
  }

  // Eliminar progress
  async remove(id: string): Promise<Progress> {
    // Verificar que el progress existe
    const progress = await this.findOne(id);

    return await this.prisma.progress.delete({
      where: { id },
    });
  }

  // ========== UTILITY METHODS ==========

  // Calcular tasa de finalización promedio
  private async calculateAverageCompletionRate(): Promise<number> {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true },
    });

    if (courses.length === 0) return 0;

    let totalCompletionRate = 0;

    for (const course of courses) {
      const totalLessons = await this.prisma.lesson.count({
        where: { module: { courseId: course.id } },
      });

      const activeEnrollments = await this.prisma.enrollment.count({
        where: { courseId: course.id, status: 'ACTIVE' },
      });

      const completedLessons = await this.prisma.progress.count({
        where: {
          enrollment: { courseId: course.id },
          completedAt: { not: null },
        },
      });

      const expectedCompletions = totalLessons * activeEnrollments;
      const courseCompletionRate =
        expectedCompletions > 0
          ? (completedLessons / expectedCompletions) * 100
          : 0;

      totalCompletionRate += courseCompletionRate;
    }

    return Math.round(totalCompletionRate / courses.length);
  }

  // Verificar si un usuario puede acceder a una lesson específica
  async canUserAccessLesson(
    userId: string,
    lessonId: string,
  ): Promise<boolean> {
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
                    OR: [
                      { expiresAt: null },
                      { expiresAt: { gte: new Date() } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });

    return !!(lesson && lesson.module.course.enrollments.length > 0);
  }

  // Obtener progreso detallado de un módulo específico
  async getModuleProgress(userId: string, moduleId: string) {
    // Verificar que el módulo existe y el usuario tiene acceso
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

  // Obtener lista de estudiantes con bajo rendimiento - ← CORREGIDO
  async getLowPerformanceStudents(
    courseId?: string,
    completionThreshold: number = 30,
  ) {
    const whereClause = courseId ? { courseId } : {};

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        ...whereClause,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
        progress: {
          where: { completedAt: { not: null } },
        },
      },
    });

    // ← CORREGIDO: Definir el tipo del array explícitamente
    const lowPerformanceStudents: Array<{
      userId: string;
      userName: string;
      email: string;
      courseId: string;
      courseTitle: string;
      enrolledAt: Date;
      totalLessons: number;
      completedLessons: number;
      completionPercentage: number;
      averageScore: number | null;
      lastActivity: Date | null;
      daysSinceLastActivity: number | null;
    }> = [];

    for (const enrollment of enrollments) {
      // Calcular progreso del estudiante
      const totalLessons = await this.prisma.lesson.count({
        where: { module: { courseId: enrollment.courseId } },
      });

      const completedLessons = enrollment.progress.length;
      const completionPercentage =
        totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      if (completionPercentage < completionThreshold) {
        // Calcular score promedio
        const scores = enrollment.progress
          .map((p) => p.score)
          .filter((score) => score !== null);
        const averageScore =
          scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        // ← CORREGIDO: Última actividad con tipo explícito
        const lastActivity: Date | null =
          enrollment.progress.reduce<Date | null>((latest, progress) => {
            return !latest ||
              (progress.completedAt && progress.completedAt > latest)
              ? progress.completedAt
              : latest;
          }, null);

        lowPerformanceStudents.push({
          userId: enrollment.user.id,
          userName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
          email: enrollment.user.email,
          courseId: enrollment.courseId,
          courseTitle: enrollment.course.title,
          enrolledAt: enrollment.enrolledAt,
          totalLessons,
          completedLessons,
          completionPercentage: Math.round(completionPercentage),
          averageScore: averageScore
            ? Math.round(averageScore * 100) / 100
            : null,
          lastActivity,
          daysSinceLastActivity: lastActivity
            ? Math.floor(
                (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null,
        });
      }
    }

    return lowPerformanceStudents.sort(
      (a, b) => a.completionPercentage - b.completionPercentage,
    );
  }

  // Generar reporte de progreso por fecha
  async getProgressReport(
    startDate: string,
    endDate: string,
    courseId?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const whereClause: any = {
      completedAt: {
        gte: start,
        lte: end,
      },
    };

    if (courseId) {
      whereClause.enrollment = { courseId };
    }

    const progressData = await this.prisma.progress.findMany({
      where: whereClause,
      include: {
        enrollment: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
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
            module: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Agrupar por día
    const dailyProgress = progressData.reduce((acc, progress) => {
      if (!progress.completedAt) return acc;

      const date = progress.completedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          completions: 0,
          uniqueStudents: new Set(),
          uniqueCourses: new Set(),
          averageScore: 0,
          scores: [],
        };
      }

      acc[date].completions++;
      acc[date].uniqueStudents.add(progress.enrollment.user.id);
      acc[date].uniqueCourses.add(progress.enrollment.course.id);

      if (progress.score !== null) {
        acc[date].scores.push(progress.score);
      }

      return acc;
    }, {});

    // Calcular promedios y convertir sets a números
    const dailyReport = Object.values(dailyProgress).map((day: any) => ({
      date: day.date,
      completions: day.completions,
      uniqueStudents: day.uniqueStudents.size,
      uniqueCourses: day.uniqueCourses.size,
      averageScore:
        day.scores.length > 0
          ? Math.round(
              (day.scores.reduce((sum, score) => sum + score, 0) /
                day.scores.length) *
                100,
            ) / 100
          : null,
    }));

    return {
      period: {
        startDate: start,
        endDate: end,
      },
      summary: {
        totalCompletions: progressData.length,
        uniqueStudents: new Set(progressData.map((p) => p.enrollment.user.id))
          .size,
        uniqueCourses: new Set(progressData.map((p) => p.enrollment.course.id))
          .size,
      },
      dailyReport: dailyReport.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
