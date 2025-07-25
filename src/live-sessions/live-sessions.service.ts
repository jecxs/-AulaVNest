// live-sessions/live-sessions.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiveSession, Prisma, RoleName } from '@prisma/client';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { CreateBulkLiveSessionsDto } from './dto/bulk-live-sessions.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';
import {
  QueryLiveSessionsDto,
  LiveSessionStatus,
} from './dto/query-live-sessions.dto';
type LiveSessionWithCourse = LiveSession & {
  course: {
    id: string;
    title: string;
    status: string;
    instructor: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    _count: {
      enrollments: number;
    };
  };
};
@Injectable()
export class LiveSessionsService {
  constructor(private prisma: PrismaService) {}

  // ========== CRUD BÁSICO ==========

  // Crear sesión en vivo
  async create(
    createLiveSessionDto: CreateLiveSessionDto,
  ): Promise<LiveSession> {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: createLiveSessionDto.courseId },
      include: {
        instructor: { select: { firstName: true, lastName: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Validar fechas
    const startsAt = new Date(createLiveSessionDto.startsAt);
    const endsAt = new Date(createLiveSessionDto.endsAt);
    const now = new Date();

    if (startsAt <= now) {
      throw new BadRequestException('Session must start in the future');
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException('End time must be after start time');
    }

    // Verificar conflictos de horario
    await this.checkScheduleConflict(
      createLiveSessionDto.courseId,
      startsAt,
      endsAt,
    );

    try {
      return await this.prisma.liveSession.create({
        data: {
          topic: createLiveSessionDto.topic,
          startsAt,
          endsAt,
          meetingUrl: createLiveSessionDto.meetingUrl,
          courseId: createLiveSessionDto.courseId,
        },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              status: true,
              instructor: {
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
      });
    } catch (error) {
      throw new BadRequestException('Failed to create live session');
    }
  }

  // Crear múltiples sesiones
  async createBulkSessions(createBulkDto: CreateBulkLiveSessionsDto): Promise<{
    successful: LiveSession[];
    failed: Array<{ session: any; error: string }>;
    summary: { total: number; successful: number; failed: number };
  }> {
    const successful: LiveSession[] = [];
    const failed: Array<{ session: any; error: string }> = [];

    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: createBulkDto.courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    for (const sessionData of createBulkDto.sessions) {
      try {
        const session = await this.create({
          ...sessionData,
          courseId: createBulkDto.courseId,
        });
        successful.push(session);
      } catch (error) {
        failed.push({
          session: sessionData,
          error: error.message,
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: createBulkDto.sessions.length,
        successful: successful.length,
        failed: failed.length,
      },
    };
  }

  // Obtener todas las sesiones con filtros
  async findAll(query: QueryLiveSessionsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      courseId,
      instructorId,
      status = LiveSessionStatus.ALL,
      dateFrom,
      dateTo,
      sortBy = 'startsAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    // Construir filtros base
    const where: Prisma.LiveSessionWhereInput = {
      ...(courseId && { courseId }),
      ...(instructorId && { course: { instructorId } }),
      ...(search && {
        OR: [
          { topic: { contains: search, mode: 'insensitive' } },
          { course: { title: { contains: search, mode: 'insensitive' } } },
          {
            course: {
              instructor: {
                firstName: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            course: {
              instructor: {
                lastName: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    // Filtros de fecha y estado
    const now = new Date();
    if (status !== LiveSessionStatus.ALL) {
      switch (status) {
        case LiveSessionStatus.UPCOMING:
          where.startsAt = { gte: now };
          break;
        case LiveSessionStatus.LIVE:
          where.AND = [{ startsAt: { lte: now } }, { endsAt: { gte: now } }];
          break;
        case LiveSessionStatus.PAST:
          where.endsAt = { lt: now };
          break;
      }
    }

    if (dateFrom || dateTo) {
      where.startsAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const orderBy: Prisma.LiveSessionOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.LiveSessionOrderByWithRelationInput] =
      sortOrder;

    const [sessions, total] = await Promise.all([
      this.prisma.liveSession.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          course: {
            include: {
              instructor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              _count: {
                select: {
                  enrollments: {
                    where: { status: 'ACTIVE' },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.liveSession.count({ where }),
    ]);

    // Enriquecer datos
    const enrichedSessions = sessions.map((session) => {
      const sessionStatus = this.getSessionStatus(
        session.startsAt,
        session.endsAt,
      );
      const duration = Math.round(
        (session.endsAt.getTime() - session.startsAt.getTime()) / (1000 * 60),
      );

      return {
        ...session,
        duration,
        courseTitle: session.course.title,
        instructorName: `${session.course.instructor.firstName} ${session.course.instructor.lastName}`,
        enrolledStudents: session.course._count.enrollments,
        status: sessionStatus,
        hasLink: !!session.meetingUrl,
        timeUntilStart:
          sessionStatus === 'upcoming'
            ? Math.round(
                (session.startsAt.getTime() - now.getTime()) / (1000 * 60),
              )
            : undefined,
      };
    });

    return {
      data: enrichedSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener sesión por ID
  async findOne(id: string): Promise<LiveSessionWithCourse> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Live session with ID ${id} not found`);
    }

    return session as LiveSessionWithCourse;
  }

  // Actualizar sesión
  async update(
    id: string,
    updateLiveSessionDto: UpdateLiveSessionDto,
  ): Promise<LiveSession> {
    const existingSession = await this.findOne(id);

    // Validar fechas si se actualizan
    if (updateLiveSessionDto.startsAt || updateLiveSessionDto.endsAt) {
      const startsAt = updateLiveSessionDto.startsAt
        ? new Date(updateLiveSessionDto.startsAt)
        : existingSession.startsAt;
      const endsAt = updateLiveSessionDto.endsAt
        ? new Date(updateLiveSessionDto.endsAt)
        : existingSession.endsAt;

      if (endsAt <= startsAt) {
        throw new BadRequestException('End time must be after start time');
      }

      // Verificar conflictos de horario (excluyendo esta sesión)
      await this.checkScheduleConflict(
        existingSession.courseId,
        startsAt,
        endsAt,
        id,
      );
    }

    const updateData: any = {};
    if (updateLiveSessionDto.topic)
      updateData.topic = updateLiveSessionDto.topic;
    if (updateLiveSessionDto.startsAt)
      updateData.startsAt = new Date(updateLiveSessionDto.startsAt);
    if (updateLiveSessionDto.endsAt)
      updateData.endsAt = new Date(updateLiveSessionDto.endsAt);
    if (updateLiveSessionDto.meetingUrl !== undefined)
      updateData.meetingUrl = updateLiveSessionDto.meetingUrl;

    return await this.prisma.liveSession.update({
      where: { id },
      data: updateData,
      include: {
        course: {
          include: {
            instructor: {
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
    });
  }

  // Eliminar sesión
  async remove(id: string): Promise<LiveSession> {
    await this.findOne(id);

    return await this.prisma.liveSession.delete({
      where: { id },
    });
  }

  // ========== MÉTODOS ESPECÍFICOS PARA SESIONES EN VIVO ==========

  // Obtener sesiones del usuario
  async getUserSessions(userId: string, query: QueryLiveSessionsDto) {
    // Obtener cursos en los que está enrollado
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    }

    return this.findAll({
      ...query,
      courseId: undefined, // Remover filtro individual de curso
    }).then((result) => ({
      ...result,
      data: result.data.filter((session) =>
        courseIds.includes(session.courseId),
      ),
    }));
  }

  // Obtener sesiones actualmente en vivo
  async getCurrentLiveSessions() {
    const now = new Date();

    return this.prisma.liveSession.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  // Obtener sesiones actualmente en vivo para un usuario
  async getUserCurrentLiveSessions(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return [];
    }

    const liveSessions = await this.getCurrentLiveSessions();
    return liveSessions.filter((session) =>
      courseIds.includes(session.courseId),
    );
  }

  // Obtener sesiones de un curso
  async getCourseSessions(
    courseId: string,
    query: QueryLiveSessionsDto,
    user: any,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const result = await this.findAll({ ...query, courseId });

    // Para estudiantes, filtrar información sensible
    if (!user.roles.includes(RoleName.ADMIN)) {
      result.data = result.data.map((session: any) => ({
        ...session,
        meetingUrl: this.shouldShowMeetingUrl(session.startsAt, session.endsAt)
          ? session.meetingUrl
          : null, // ← CAMBIAR undefined por null
      }));
    }

    return result;
  }

  // Obtener próxima sesión de un curso
  async getNextCourseSession(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const now = new Date();
    const nextSession = await this.prisma.liveSession.findFirst({
      where: {
        courseId,
        startsAt: { gte: now },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    if (!nextSession) {
      return {
        message: 'No upcoming sessions for this course',
        hasNext: false,
        nextSession: null,
      };
    }

    const timeUntilStart = Math.round(
      (nextSession.startsAt.getTime() - now.getTime()) / (1000 * 60),
    );
    const duration = Math.round(
      (nextSession.endsAt.getTime() - nextSession.startsAt.getTime()) /
        (1000 * 60),
    );

    return {
      message: 'Next session found',
      hasNext: true,
      nextSession: {
        ...nextSession,
        timeUntilStart,
        duration,
        instructorName: `${nextSession.course.instructor.firstName} ${nextSession.course.instructor.lastName}`,
      },
    };
  }

  // Vista calendario
  async getCalendarView(days: number = 30) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Agrupar por fecha
    const calendarData = sessions.reduce((acc, session) => {
      const date = session.startsAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }

      acc[date].push({
        id: session.id,
        topic: session.topic,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        duration: Math.round(
          (session.endsAt.getTime() - session.startsAt.getTime()) / (1000 * 60),
        ),
        courseTitle: session.course.title,
        instructorName: `${session.course.instructor.firstName} ${session.course.instructor.lastName}`,
        hasLink: !!session.meetingUrl,
      });

      return acc;
    }, {});

    return {
      period: {
        from: now,
        to: futureDate,
        days,
      },
      totalSessions: sessions.length,
      calendar: calendarData,
    };
  }

  // Vista calendario para usuario
  async getUserCalendarView(userId: string, days: number = 30) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return {
        period: { days },
        totalSessions: 0,
        calendar: {},
      };
    }

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        courseId: { in: courseIds },
        startsAt: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Agrupar por fecha
    const calendarData = sessions.reduce((acc, session) => {
      const date = session.startsAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }

      const showMeetingUrl = this.shouldShowMeetingUrl(
        session.startsAt,
        session.endsAt,
      );

      acc[date].push({
        id: session.id,
        topic: session.topic,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        duration: Math.round(
          (session.endsAt.getTime() - session.startsAt.getTime()) / (1000 * 60),
        ),
        courseTitle: session.course.title,
        instructorName: `${session.course.instructor.firstName} ${session.course.instructor.lastName}`,
        canJoin: showMeetingUrl && !!session.meetingUrl,
        meetingUrl: showMeetingUrl ? session.meetingUrl : null, // ← CAMBIAR undefined por null
      });

      return acc;
    }, {});

    return {
      period: {
        from: now,
        to: futureDate,
        days,
      },
      totalSessions: sessions.length,
      calendar: calendarData,
    };
  }

  // Obtener sesión para estudiante (información limitada)
  async getSessionForStudent(sessionId: string, userId: string) {
    const session = await this.findOne(sessionId);

    const showMeetingUrl = this.shouldShowMeetingUrl(
      session.startsAt,
      session.endsAt,
    );
    const status = this.getSessionStatus(session.startsAt, session.endsAt);
    const now = new Date();

    return {
      id: session.id,
      topic: session.topic,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      courseTitle: session.course.title,
      instructorName: `${session.course.instructor.firstName} ${session.course.instructor.lastName}`,
      status,
      canJoin: showMeetingUrl && !!session.meetingUrl,
      meetingUrl: showMeetingUrl ? session.meetingUrl : null,
      timeUntilStart:
        status === 'upcoming'
          ? Math.round(
              (session.startsAt.getTime() - now.getTime()) / (1000 * 60),
            )
          : undefined,
    };
  }

  // Unirse a sesión
  async joinSession(sessionId: string, userId: string) {
    const session = await this.findOne(sessionId);

    // Verificar acceso al curso
    await this.checkUserCourseAccess(session.courseId, userId);

    const now = new Date();
    const sessionStatus = this.getSessionStatus(
      session.startsAt,
      session.endsAt,
    );

    // Verificar que la sesión esté disponible para unirse
    if (sessionStatus === 'past') {
      throw new BadRequestException('This session has already ended');
    }

    if (sessionStatus === 'upcoming') {
      const minutesUntilStart = Math.round(
        (session.startsAt.getTime() - now.getTime()) / (1000 * 60),
      );
      if (minutesUntilStart > 15) {
        throw new BadRequestException(
          `Session starts in ${minutesUntilStart} minutes. Join link will be available 15 minutes before start.`,
        );
      }
    }

    if (!session.meetingUrl) {
      throw new BadRequestException('Meeting link is not available yet');
    }

    return {
      sessionId: session.id,
      topic: session.topic,
      meetingUrl: session.meetingUrl,
      message:
        sessionStatus === 'live'
          ? 'Session is live now'
          : 'You can join the session',
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    };
  }

  // Marcar sesión como iniciada
  async markSessionAsStarted(sessionId: string) {
    const session = await this.findOne(sessionId);
    const now = new Date();

    if (now < session.startsAt) {
      throw new BadRequestException(
        'Cannot start session before scheduled time',
      );
    }

    if (now > session.endsAt) {
      throw new BadRequestException('Session time has already passed');
    }

    return {
      message: 'Session marked as started',
      sessionId,
      startedAt: now,
      topic: session.topic,
      enrolledStudents: session.course._count.enrollments,
    };
  }
  // Marcar sesión como finalizada
  async markSessionAsEnded(sessionId: string) {
    const session = await this.findOne(sessionId);
    const now = new Date();

    if (now < session.startsAt) {
      throw new BadRequestException('Cannot end session that has not started');
    }

    return {
      message: 'Session marked as ended',
      sessionId,
      endedAt: now,
      topic: session.topic,
      scheduledEnd: session.endsAt,
      actualDuration: Math.round(
        (now.getTime() - session.startsAt.getTime()) / (1000 * 60),
      ),
    };
  }

  // ========== ESTADÍSTICAS Y REPORTES ==========

  // Obtener estadísticas de sesiones en vivo
  async getLiveSessionStats() {
    const now = new Date();

    const [
      totalSessions,
      upcomingSessions,
      liveSessions,
      pastSessions,
      sessionsWithLinks,
      avgDuration,
      sessionsThisWeek,
      sessionsThisMonth,
    ] = await Promise.all([
      this.prisma.liveSession.count(),
      this.prisma.liveSession.count({
        where: { startsAt: { gte: now } },
      }),
      this.prisma.liveSession.count({
        where: {
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      }),
      this.prisma.liveSession.count({
        where: { endsAt: { lt: now } },
      }),
      this.prisma.liveSession.count({
        where: { meetingUrl: { not: null } },
      }),
      // Calcular duración promedio
      this.calculateAverageDuration(),
      // Sesiones esta semana
      this.prisma.liveSession.count({
        where: {
          startsAt: {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Sesiones este mes
      this.prisma.liveSession.count({
        where: {
          startsAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      total: totalSessions,
      byStatus: {
        upcoming: upcomingSessions,
        live: liveSessions,
        past: pastSessions,
      },
      configuration: {
        withLinks: sessionsWithLinks,
        withoutLinks: totalSessions - sessionsWithLinks,
      },
      metrics: {
        averageDurationMinutes: avgDuration,
        sessionsThisWeek,
        sessionsThisMonth,
      },
    };
  }

  // ========== MÉTODOS DE LIMPIEZA ==========

  // Limpiar sesiones pasadas
  async cleanupPastSessions(courseId: string, olderThanDays: number = 30) {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );

    const deletedSessions = await this.prisma.liveSession.deleteMany({
      where: {
        courseId,
        endsAt: { lt: cutoffDate },
      },
    });

    return {
      message: `Cleaned up sessions older than ${olderThanDays} days`,
      deletedCount: deletedSessions.count,
      courseId,
      cutoffDate,
    };
  }

  // ========== VERIFICACIONES Y VALIDACIONES ==========

  // Verificar acceso del usuario al curso
  async checkUserCourseAccess(courseId: string, userId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    if (enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('Your enrollment is not active');
    }

    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
      throw new ForbiddenException('Your enrollment has expired');
    }

    return true;
  }

  // Verificar conflictos de horario
  private async checkScheduleConflict(
    courseId: string,
    startsAt: Date,
    endsAt: Date,
    excludeSessionId?: string,
  ) {
    const conflictSession = await this.prisma.liveSession.findFirst({
      where: {
        courseId,
        ...(excludeSessionId && { NOT: { id: excludeSessionId } }),
        OR: [
          // Nueva sesión empieza durante una existente
          {
            startsAt: { lte: startsAt },
            endsAt: { gt: startsAt },
          },
          // Nueva sesión termina durante una existente
          {
            startsAt: { lt: endsAt },
            endsAt: { gte: endsAt },
          },
          // Nueva sesión contiene una existente
          {
            startsAt: { gte: startsAt },
            endsAt: { lte: endsAt },
          },
        ],
      },
    });

    if (conflictSession) {
      throw new ConflictException(
        `Schedule conflict with existing session: ${conflictSession.topic}`,
      );
    }
  }

  // ========== MÉTODOS UTILITARIOS ==========

  // Determinar estado de la sesión
  private getSessionStatus(
    startsAt: Date,
    endsAt: Date,
  ): 'upcoming' | 'live' | 'past' {
    const now = new Date();

    if (now < startsAt) {
      return 'upcoming';
    } else if (now >= startsAt && now <= endsAt) {
      return 'live';
    } else {
      return 'past';
    }
  }

  // Determinar si mostrar URL de reunión
  private shouldShowMeetingUrl(startsAt: Date, endsAt: Date): boolean {
    const now = new Date();
    const fifteenMinutesBefore = new Date(startsAt.getTime() - 15 * 60 * 1000);

    // Mostrar 15 minutos antes del inicio hasta el final
    return now >= fifteenMinutesBefore && now <= endsAt;
  }

  // Calcular duración promedio
  private async calculateAverageDuration(): Promise<number> {
    const sessions = await this.prisma.liveSession.findMany({
      select: { startsAt: true, endsAt: true },
    });

    if (sessions.length === 0) return 0;

    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (session.endsAt.getTime() - session.startsAt.getTime());
    }, 0);

    return Math.round(totalDuration / (sessions.length * 1000 * 60)); // En minutos
  }
}
