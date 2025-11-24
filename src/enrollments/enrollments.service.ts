import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { Enrollment, EnrollmentStatus, Prisma } from '@prisma/client';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

import { CreateManualEnrollmentDto } from './dto/create-manual-enrollment.dto';

import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';

import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';

import { EnrollmentWithProgress } from './dto/enrollment-response.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private prisma: PrismaService,

    private notificationsService: NotificationsService,
  ) {}

  // ========== ENROLLMENT CREATION ==========

  // Crear enrollment directo

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    // Verificar que el usuario existe

    const user = await this.prisma.user.findUnique({
      where: { id: createEnrollmentDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verificar que el curso existe

    const course = await this.prisma.course.findUnique({
      where: { id: createEnrollmentDto.courseId },

      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verificar que el admin que enrolla existe

    const enrolledBy = await this.prisma.user.findUnique({
      where: { id: createEnrollmentDto.enrolledById },
    });

    if (!enrolledBy) {
      throw new NotFoundException('Enrolling user not found');
    }

    // Verificar que no existe un enrollment activo

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: createEnrollmentDto.userId,

          courseId: createEnrollmentDto.courseId,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('User is already enrolled in this course');
    }

    try {
      // Crear enrollment

      const enrollment = await this.prisma.enrollment.create({
        data: createEnrollmentDto,

        include: {
          user: {
            select: {
              id: true,

              email: true,

              firstName: true,

              lastName: true,

              phone: true,
            },
          },

          course: {
            select: {
              id: true,

              title: true,

              slug: true,

              price: true,

              level: true,

              category: {
                select: { name: true },
              },
            },
          },

          enrolledBy: {
            select: {
              id: true,

              email: true,

              firstName: true,

              lastName: true,
            },
          },
        },
      });

      // 🔔 EMITIR NOTIFICACIÓN DE NUEVA MATRICULACIÓN

      await this.emitEnrollmentNotification(enrollment.userId, course);

      return enrollment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'User is already enrolled in this course',
          );
        }
      }

      throw error;
    }
  }

  // Crear enrollment manual por email

  async createManualEnrollment(
    createManualEnrollmentDto: CreateManualEnrollmentDto,

    enrolledById: string,
  ): Promise<Enrollment> {
    // Buscar usuario por email

    const user = await this.prisma.user.findUnique({
      where: { email: createManualEnrollmentDto.userEmail },
    });

    if (!user) {
      throw new NotFoundException(
        `User with email ${createManualEnrollmentDto.userEmail} not found`,
      );
    }

    const createDto: CreateEnrollmentDto = {
      userId: user.id,

      courseId: createManualEnrollmentDto.courseId,

      enrolledById: enrolledById,

      paymentConfirmed: createManualEnrollmentDto.paymentConfirmed,

      expiresAt: createManualEnrollmentDto.expiresAt,
    };

    return this.create(createDto);
  }

  // Enrollment masivo

  async bulkEnrollment(
    bulkEnrollmentDto: BulkEnrollmentDto,

    enrolledById: string,
  ): Promise<{
    successful: Enrollment[];

    failed: Array<{ email: string; error: string }>;

    summary: { total: number; successful: number; failed: number };
  }> {
    const successful: Enrollment[] = [];

    const failed: Array<{ email: string; error: string }> = [];

    // Verificar que el curso existe

    const course = await this.prisma.course.findUnique({
      where: { id: bulkEnrollmentDto.courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    for (const userInfo of bulkEnrollmentDto.users) {
      try {
        const enrollment = await this.createManualEnrollment(
          {
            userEmail: userInfo.userEmail,

            courseId: bulkEnrollmentDto.courseId,

            paymentConfirmed: bulkEnrollmentDto.paymentConfirmed,

            expiresAt: bulkEnrollmentDto.expiresAt,
          },

          enrolledById,
        );

        successful.push(enrollment);
      } catch (error) {
        failed.push({
          email: userInfo.userEmail,

          error: error.message,
        });
      }
    }

    return {
      successful,

      failed,

      summary: {
        total: bulkEnrollmentDto.users.length,

        successful: successful.length,

        failed: failed.length,
      },
    };
  }

  private async emitEnrollmentNotification(userId: string, course: any) {
    try {
      await this.notificationsService.createEnrollmentNotification(userId, {
        courseTitle: course.title,

        courseId: course.id,
      });

      console.log(
        `📚 Enrollment notification sent for user ${userId} in course ${course.title}`,
      );
    } catch (error) {
      // No fallar el enrollment por errores en notificaciones

      console.error('Error emitting enrollment notification:', error);
    }
  }

  // ========== ENROLLMENT QUERIES ==========

  // ✅ MÉTODO CORREGIDO: Obtener todos los enrollments con filtros

  async findAll(query: QueryEnrollmentsDto) {
    const {
      page = 1,

      limit = 10,

      userId,

      courseId,

      status,

      paymentConfirmed,

      expired,

      search,

      sortBy = 'enrolledAt',

      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    // Construir condiciones WHERE

    const where: any = {};

    if (userId) where.userId = userId;

    if (courseId) where.courseId = courseId;

    if (status) where.status = status;

    if (paymentConfirmed !== undefined)
      where.paymentConfirmed = paymentConfirmed;

    // Filtro de búsqueda

    if (search) {
      where.OR = [
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },

              { lastName: { contains: search, mode: 'insensitive' } },

              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },

        {
          course: {
            title: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    // Filtro de expiración

    if (expired !== undefined) {
      if (expired) {
        where.expiresAt = { lt: new Date() };
      } else {
        where.OR = [{ expiresAt: null }, { expiresAt: { gte: new Date() } }];
      }
    }

    // Obtener enrollments con paginación

    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,

        include: {
          user: {
            select: {
              id: true,

              email: true,

              firstName: true,

              lastName: true,

              phone: true,
            },
          },

          course: {
            select: {
              id: true,

              title: true,

              slug: true,

              summary: true,

              description: true,

              price: true,

              level: true,

              thumbnailUrl: true,

              estimatedHours: true,

              category: {
                select: { name: true, slug: true },
              },

              instructor: {
                select: {
                  id: true,

                  firstName: true,

                  lastName: true,
                },
              },

              _count: {
                select: {
                  modules: true,

                  enrollments: true,
                },
              },
            },
          },

          enrolledBy: {
            select: {
              id: true,

              email: true,

              firstName: true,

              lastName: true,
            },
          },
        },

        skip,

        take: limit,

        orderBy: { [sortBy]: sortOrder },
      }),

      this.prisma.enrollment.count({ where }),
    ]);

    // ✅ CORREGIDO: Enriquecer con datos de progreso

    const enrichedEnrollments: EnrollmentWithProgress[] = await Promise.all(
      enrollments.map(async (enrollment) => {
        // Calcular progreso del usuario en este curso

        const progress = await this.calculateUserProgress(
          enrollment.userId,

          enrollment.courseId,
        );

        return {
          ...enrollment,

          progress, // ✅ Ahora incluye completedLessons, totalLessons, completionPercentage
        } as EnrollmentWithProgress;
      }),
    );

    return {
      data: enrichedEnrollments,

      pagination: {
        page,

        limit,

        total,

        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ✅ MÉTODO CORREGIDO: Obtener progreso de un enrollment específico

  async getEnrollmentProgress(enrollmentId: string) {
    // Obtener el enrollment para conseguir userId y courseId

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },

      select: { userId: true, courseId: true },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} not found`,
      );
    }

    return this.calculateUserProgress(enrollment.userId, enrollment.courseId);
  }

  // Obtener enrollments pendientes de pago

  async findPendingPayment(query: QueryEnrollmentsDto) {
    return this.findAll({
      ...query,

      paymentConfirmed: false,

      status: EnrollmentStatus.ACTIVE,
    });
  }

  // Obtener enrollments expirados

  async findExpired(query: QueryEnrollmentsDto) {
    return this.findAll({
      ...query,

      expired: true,
    });
  }

  // Obtener enrollments que expiran pronto

  async findExpiringSoon(days: number = 7) {
    const futureDate = new Date();

    futureDate.setDate(futureDate.getDate() + days);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        status: EnrollmentStatus.ACTIVE,

        expiresAt: {
          gte: new Date(),

          lte: futureDate,
        },
      },

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
          select: {
            id: true,

            title: true,

            slug: true,

            summary: true,

            description: true,

            price: true,

            level: true,

            thumbnailUrl: true,

            estimatedHours: true,

            category: {
              select: { name: true, slug: true },
            },

            instructor: {
              select: {
                id: true,

                firstName: true,

                lastName: true,
              },
            },

            _count: {
              select: {
                modules: true,

                enrollments: true,
              },
            },
          },
        },
      },

      orderBy: { expiresAt: 'asc' },
    });

    // ✅ Agregar progreso a cada enrollment

    return await Promise.all(
      enrollments.map(async (enrollment) => {
        const progress = await this.calculateUserProgress(
          enrollment.userId,

          enrollment.courseId,
        );

        return { ...enrollment, progress };
      }),
    );
  }

  // ========== ENROLLMENT BY USER/COURSE ==========

  // Obtener enrollments de un usuario

  async getUserEnrollments(userId: string, query: QueryEnrollmentsDto) {
    // Verificar que el usuario existe

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.findAll({ ...query, userId });
  }

  // Obtener enrollments de un curso

  async getCourseEnrollments(courseId: string, query: QueryEnrollmentsDto) {
    // Verificar que el curso existe

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.findAll({ ...query, courseId });
  }

  // Obtener estadísticas de enrollments de un curso

  async getCourseEnrollmentStats(courseId: string) {
    // Verificar que el curso existe

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const [
      total,

      active,

      suspended,

      completed,

      expired,

      pendingPayment,

      confirmedPayment,
    ] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId } }),

      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.ACTIVE },
      }),

      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.SUSPENDED },
      }),

      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.COMPLETED },
      }),

      this.prisma.enrollment.count({
        where: {
          courseId,

          expiresAt: { lt: new Date() },
        },
      }),

      this.prisma.enrollment.count({
        where: { courseId, paymentConfirmed: false },
      }),

      this.prisma.enrollment.count({
        where: { courseId, paymentConfirmed: true },
      }),
    ]);

    return {
      total,

      byStatus: {
        active,

        suspended,

        completed,

        expired,
      },

      byPayment: {
        pending: pendingPayment,

        confirmed: confirmedPayment,
      },

      course: {
        id: course.id,

        title: course.title,
      },
    };
  }

  // ========== INDIVIDUAL ENROLLMENT OPERATIONS ==========

  // ✅ MÉTODO CORREGIDO: Obtener enrollment por ID

  async findOne(id: string): Promise<EnrollmentWithProgress> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },

      include: {
        user: {
          select: {
            id: true,

            email: true,

            firstName: true,

            lastName: true,

            phone: true,
          },
        },

        course: {
          select: {
            id: true,

            title: true,

            slug: true,

            summary: true,

            description: true,

            price: true,

            level: true,

            status: true,

            thumbnailUrl: true,

            estimatedHours: true,

            category: {
              select: { name: true, slug: true },
            },

            instructor: {
              select: {
                id: true,

                firstName: true,

                lastName: true,
              },
            },

            _count: {
              select: {
                modules: true,

                enrollments: true,
              },
            },
          },
        },

        enrolledBy: {
          select: {
            id: true,

            email: true,

            firstName: true,

            lastName: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    // Calcular progreso del usuario

    const progress = await this.calculateUserProgress(
      enrollment.userId,

      enrollment.courseId,
    );

    // ✅ Retornar con progreso incluido

    return {
      ...enrollment,

      progress,
    } as EnrollmentWithProgress;
  }

  // Actualizar enrollment

  async update(
    id: string,

    updateEnrollmentDto: UpdateEnrollmentDto,
  ): Promise<Enrollment> {
    // Verificar que el enrollment existe

    await this.findOne(id);

    try {
      return await this.prisma.enrollment.update({
        where: { id },

        data: updateEnrollmentDto,

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
            select: {
              id: true,

              title: true,

              price: true,
            },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to update enrollment');
    }
  }

  // ========== ENROLLMENT STATUS MANAGEMENT ==========

  // Confirmar pago

  async confirmPayment(id: string): Promise<Enrollment> {
    const enrollment = await this.findOne(id);

    if (enrollment.paymentConfirmed) {
      throw new BadRequestException('Payment is already confirmed');
    }

    return await this.prisma.enrollment.update({
      where: { id },

      data: {
        paymentConfirmed: true,

        status: EnrollmentStatus.ACTIVE,
      },

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
          select: {
            id: true,

            title: true,
          },
        },
      },
    });
  }

  // Activar enrollment

  async activateEnrollment(id: string): Promise<Enrollment> {
    await this.findOne(id);

    return await this.prisma.enrollment.update({
      where: { id },

      data: { status: EnrollmentStatus.ACTIVE },

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
          select: {
            id: true,

            title: true,
          },
        },
      },
    });
  }

  // Suspender enrollment

  async suspendEnrollment(id: string): Promise<Enrollment> {
    await this.findOne(id);

    return await this.prisma.enrollment.update({
      where: { id },

      data: { status: EnrollmentStatus.SUSPENDED },

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
          select: {
            id: true,

            title: true,
          },
        },
      },
    });
  }

  // Completar enrollment

  async completeEnrollment(id: string): Promise<Enrollment> {
    await this.findOne(id);

    return await this.prisma.enrollment.update({
      where: { id },

      data: { status: EnrollmentStatus.COMPLETED },

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
          select: {
            id: true,

            title: true,
          },
        },
      },
    });
  }

  // Extender enrollment

  async extendEnrollment(id: string, months: number): Promise<Enrollment> {
    const enrollment = await this.findOne(id);

    // Calcular nueva fecha de expiración

    const currentExpiry = enrollment.expiresAt || new Date();

    const newExpiry = new Date(currentExpiry);

    newExpiry.setMonth(newExpiry.getMonth() + months);

    return await this.prisma.enrollment.update({
      where: { id },

      data: { expiresAt: newExpiry },

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
          select: {
            id: true,

            title: true,
          },
        },
      },
    });
  }

  // ========== ENROLLMENT ACCESS VERIFICATION ==========

  // Verificar acceso a curso

  async checkUserAccessToCourse(courseId: string, userId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,

          courseId,
        },
      },

      include: {
        course: {
          select: {
            id: true,

            title: true,

            status: true,
          },
        },
      },
    });

    if (!enrollment) {
      return {
        hasAccess: false,

        reason: 'Not enrolled in this course',

        enrollment: null,
      };
    }

    // Verificar estado del enrollment

    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      return {
        hasAccess: false,

        reason: `Enrollment is ${enrollment.status.toLowerCase()}`,

        enrollment,
      };
    }

    // Verificar si está expirado

    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
      return {
        hasAccess: false,

        reason: 'Enrollment has expired',

        enrollment,
      };
    }

    // Verificar estado del curso

    if (enrollment.course.status !== 'PUBLISHED') {
      return {
        hasAccess: false,

        reason: 'Course is not published',

        enrollment,
      };
    }

    return {
      hasAccess: true,

      reason: 'Access granted',

      enrollment,
    };
  }

  // Verificar acceso a lesson específica

  async checkUserAccessToLesson(
    courseId: string,

    lessonId: string,

    userId: string,
  ) {
    // Primero verificar acceso al curso

    const courseAccess = await this.checkUserAccessToCourse(courseId, userId);

    if (!courseAccess.hasAccess) {
      return courseAccess;
    }

    // Verificar que la lesson pertenece al curso

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,

        module: {
          courseId,
        },
      },

      include: {
        module: {
          select: {
            id: true,

            title: true,

            isRequired: true,
          },
        },
      },
    });

    if (!lesson) {
      return {
        hasAccess: false,

        reason: 'Lesson not found in this course',

        enrollment: courseAccess.enrollment,
      };
    }

    return {
      hasAccess: true,

      reason: 'Access granted to lesson',

      enrollment: courseAccess.enrollment,

      lesson: {
        id: lesson.id,

        title: lesson.title,

        module: lesson.module,
      },
    };
  }

  // ========== ENROLLMENT STATISTICS ==========

  // Obtener estadísticas generales de enrollments

  async getEnrollmentStats() {
    const [
      total,

      active,

      suspended,

      completed,

      expired,

      pendingPayment,

      recentEnrollments,
    ] = await Promise.all([
      this.prisma.enrollment.count(),

      this.prisma.enrollment.count({
        where: { status: EnrollmentStatus.ACTIVE },
      }),

      this.prisma.enrollment.count({
        where: { status: EnrollmentStatus.SUSPENDED },
      }),

      this.prisma.enrollment.count({
        where: { status: EnrollmentStatus.COMPLETED },
      }),

      this.prisma.enrollment.count({
        where: { expiresAt: { lt: new Date() } },
      }),

      this.prisma.enrollment.count({
        where: { paymentConfirmed: false },
      }),

      this.prisma.enrollment.count({
        where: {
          enrolledAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 días
          },
        },
      }),
    ]);

    return {
      total,

      byStatus: {
        active,

        suspended,

        completed,

        expired,
      },

      byPayment: {
        pending: pendingPayment,

        confirmed: total - pendingPayment,
      },

      recent: {
        last30Days: recentEnrollments,
      },
    };
  }

  // ========== UTILITY METHODS ==========

  // ✅ MÉTODO CRÍTICO: Calcular progreso del usuario en un curso

  async calculateUserProgress(userId: string, courseId: string) {
    // Obtener enrollment (necesario para el enrollmentId)

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,

          courseId,
        },
      },
    });

    if (!enrollment) {
      // Si no hay enrollment, retornar progreso en 0

      return {
        completedLessons: 0,

        totalLessons: 0,

        completionPercentage: 0,
      };
    }

    // Obtener total de lessons del curso

    const totalLessons = await this.prisma.lesson.count({
      where: {
        module: {
          courseId,
        },
      },
    });

    // Obtener lessons completadas por el usuario (basado en la tabla Progress)

    const completedLessons = await this.prisma.progress.count({
      where: {
        enrollmentId: enrollment.id,

        completedAt: {
          not: null,
        },
      },
    });

    const completionPercentage =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    return {
      completedLessons,

      totalLessons,

      completionPercentage,
    };
  }

  // Limpiar enrollments expirados

  async cleanupExpiredEnrollments() {
    const expiredEnrollments = await this.prisma.enrollment.findMany({
      where: {
        expiresAt: { lt: new Date() },

        status: { not: EnrollmentStatus.EXPIRED },
      },
    });

    if (expiredEnrollments.length === 0) {
      return {
        message: 'No expired enrollments found',

        updated: 0,
      };
    }

    const updated = await this.prisma.enrollment.updateMany({
      where: {
        expiresAt: { lt: new Date() },

        status: { not: EnrollmentStatus.EXPIRED },
      },

      data: {
        status: EnrollmentStatus.EXPIRED,
      },
    });

    return {
      message: `Updated ${updated.count} expired enrollments`,

      updated: updated.count,

      details: expiredEnrollments.map((e) => ({
        id: e.id,

        userId: e.userId,

        courseId: e.courseId,

        expiredAt: e.expiresAt,
      })),
    };
  }

  // ========== ENROLLMENT DELETION ==========

  // Eliminar enrollment

  async remove(id: string): Promise<Enrollment> {
    // Verificar que el enrollment existe

    const enrollment = await this.findOne(id);

    // Eliminar progreso relacionado

    await this.prisma.progress.deleteMany({
      where: { enrollmentId: id },
    });

    // Eliminar certificados relacionados

    await this.prisma.certificate.deleteMany({
      where: { enrollmentId: id },
    });

    // Eliminar receipts de pago relacionados

    await this.prisma.paymentReceipt.deleteMany({
      where: { enrollmentId: id },
    });

    // Eliminar enrollment

    return await this.prisma.enrollment.delete({
      where: { id },
    });
  }
}
