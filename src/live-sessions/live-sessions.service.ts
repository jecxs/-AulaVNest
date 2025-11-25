// live-sessions/live-sessions.service.ts - VERSIÓN SIMPLIFICADA

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiveSession } from '@prisma/client';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';

@Injectable()
export class LiveSessionsService {
  constructor(private prisma: PrismaService) {}

  // ========== CRUD BÁSICO (SOLO ADMIN) ==========

  /**
   * Crear una nueva sesión en vivo
   */
  async create(createDto: CreateLiveSessionDto): Promise<LiveSession> {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: createDto.courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    // Validar fechas
    const startsAt = new Date(createDto.startsAt);
    const endsAt = new Date(createDto.endsAt);
    const now = new Date();

    if (startsAt <= now) {
      throw new BadRequestException(
        'La sesión debe programarse para el futuro',
      );
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }

    // Verificar si hay conflictos de horario en el mismo curso
    await this.checkScheduleConflict(createDto.courseId, startsAt, endsAt);

    // Crear la sesión
    return await this.prisma.liveSession.create({
      data: {
        topic: createDto.topic,
        startsAt,
        endsAt,
        meetingUrl: createDto.meetingUrl || null,
        courseId: createDto.courseId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Listar todas las sesiones (con filtros opcionales)
   * Solo para ADMIN
   */
  async findAll(courseId?: string) {
    const where: any = {};

    if (courseId) {
      where.courseId = courseId;
    }

    return await this.prisma.liveSession.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: { enrollments: true },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  /**
   * Obtener una sesión por ID
   */
  async findOne(id: string): Promise<LiveSession> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    return session;
  }

  /**
   * Actualizar una sesión existente
   */
  async update(id: string, updateDto: UpdateLiveSessionDto): Promise<LiveSession> {
    const existingSession = await this.findOne(id);

    // Si se actualizan las fechas, validarlas
    if (updateDto.startsAt || updateDto.endsAt) {
      const startsAt = updateDto.startsAt
        ? new Date(updateDto.startsAt)
        : existingSession.startsAt;
      const endsAt = updateDto.endsAt
        ? new Date(updateDto.endsAt)
        : existingSession.endsAt;

      if (endsAt <= startsAt) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la hora de inicio',
        );
      }

      // Verificar conflictos (excluyendo esta sesión)
      await this.checkScheduleConflict(
        existingSession.courseId,
        startsAt,
        endsAt,
        id,
      );
    }

    // Construir objeto de actualización
    const updateData: any = {};
    if (updateDto.topic) updateData.topic = updateDto.topic;
    if (updateDto.startsAt) updateData.startsAt = new Date(updateDto.startsAt);
    if (updateDto.endsAt) updateData.endsAt = new Date(updateDto.endsAt);
    if (updateDto.meetingUrl !== undefined) updateData.meetingUrl = updateDto.meetingUrl;

    return await this.prisma.liveSession.update({
      where: { id },
      data: updateData,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Eliminar una sesión
   */
  async remove(id: string): Promise<LiveSession> {
    await this.findOne(id); // Verificar que existe

    return await this.prisma.liveSession.delete({
      where: { id },
    });
  }

  // ========== CONSULTAS PARA ESTUDIANTES ==========

  /**
   * Obtener las sesiones de los cursos en los que está matriculado un usuario
   */
  async getStudentSessions(userId: string) {
    // Obtener IDs de cursos donde está matriculado
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return [];
    }

    // Obtener sesiones de esos cursos
    return await this.prisma.liveSession.findMany({
      where: {
        courseId: { in: courseIds },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
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
  }

  /**
   * Obtener próximas sesiones de un estudiante
   */
  async getStudentUpcomingSessions(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) {
      return [];
    }

    const now = new Date();

    return await this.prisma.liveSession.findMany({
      where: {
        courseId: { in: courseIds },
        startsAt: { gte: now },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
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
  }

  /**
   * Obtener sesiones de un curso específico
   * (para usar en la página de detalle del curso)
   */
  async getCourseSessions(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return await this.prisma.liveSession.findMany({
      where: { courseId },
      orderBy: { startsAt: 'asc' },
    });
  }

  /**
   * Verificar si un estudiante tiene acceso a un curso
   */
  async checkStudentCourseAccess(courseId: string, userId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        courseId,
        userId,
        status: 'ACTIVE',
      },
    });

    return !!enrollment;
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Verificar si hay conflicto de horarios en el mismo curso
   */
  private async checkScheduleConflict(
    courseId: string,
    startsAt: Date,
    endsAt: Date,
    excludeSessionId?: string,
  ): Promise<void> {
    const conflictingSession = await this.prisma.liveSession.findFirst({
      where: {
        courseId,
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        OR: [
          {
            startsAt: { lte: startsAt },
            endsAt: { gt: startsAt },
          },
          {
            startsAt: { lt: endsAt },
            endsAt: { gte: endsAt },
          },
          {
            startsAt: { gte: startsAt },
            endsAt: { lte: endsAt },
          },
        ],
      },
    });

    if (conflictingSession) {
      throw new ConflictException(
        `Ya existe una sesión programada en este horario para este curso`,
      );
    }
  }

  /**
   * Calcular el estado de una sesión basado en sus fechas
   */
  getSessionStatus(startsAt: Date, endsAt: Date): 'upcoming' | 'live' | 'past' {
    const now = new Date();

    if (now < startsAt) return 'upcoming';
    if (now >= startsAt && now <= endsAt) return 'live';
    return 'past';
  }
}