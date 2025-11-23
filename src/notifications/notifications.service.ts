// notifications/notifications.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { NotificationSummaryDto } from './dto/notification-response.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ========== CREATE NOTIFICATIONS ==========

  // Crear notificación
  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: createNotificationDto.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prisma.notification.create({
        data: createNotificationDto,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to create notification');
    }
  }

  // ========== MÉTODOS ESPECÍFICOS PARA CREAR NOTIFICACIONES ==========

  // Módulo completado
  async createModuleCompletedNotification(userId: string, moduleData: any) {
    return this.create({
      userId,
      type: NotificationType.MODULE_COMPLETED,
      payload: {
        moduleTitle: moduleData.title,
        courseName: moduleData.courseName,
        courseId: moduleData.courseId,
        moduleId: moduleData.moduleId,
      },
    });
  }

  // Quiz aprobado
  async createQuizPassedNotification(userId: string, quizData: any) {
    return this.create({
      userId,
      type: NotificationType.QUIZ_PASSED,
      payload: {
        quizTitle: quizData.title,
        score: quizData.score,
        percentage: quizData.percentage,
        courseName: quizData.courseName,
      },
    });
  }

  // Quiz reprobado
  async createQuizFailedNotification(userId: string, quizData: any) {
    return this.create({
      userId,
      type: NotificationType.QUIZ_FAILED,
      payload: {
        quizTitle: quizData.title,
        score: quizData.score,
        percentage: quizData.percentage,
        passingScore: quizData.passingScore,
        courseName: quizData.courseName,
      },
    });
  }

  // Curso completado
  async createCourseCompletedNotification(userId: string, courseData: any) {
    return this.create({
      userId,
      type: NotificationType.COURSE_COMPLETED,
      payload: {
        courseTitle: courseData.title,
        courseId: courseData.id,
        completedAt: new Date().toISOString(),
      },
    });
  }

  // Recordatorio de sesión en vivo
  async createLiveSessionReminderNotification(
    userId: string,
    sessionData: any,
  ) {
    return this.create({
      userId,
      type: NotificationType.LIVE_SESSION_REMINDER,
      payload: {
        sessionId: sessionData.sessionId, // ← AGREGAR para tracking
        sessionTopic: sessionData.topic,
        startsAt: sessionData.startsAt,
        courseName: sessionData.courseName,
        meetingUrl: sessionData.meetingUrl,
        minutesUntilStart: Math.floor(
          (new Date(sessionData.startsAt).getTime() - new Date().getTime()) /
            (1000 * 60),
        ),
      },
    });
  }
  async hasLiveSessionNotificationBeenSent(
    sessionId: string,
  ): Promise<boolean> {
    const count = await this.prisma.notification.count({
      where: {
        type: NotificationType.LIVE_SESSION_REMINDER,
        payload: {
          path: ['sessionId'],
          equals: sessionId,
        },
      },
    });

    return count > 0;
  }

  // Nueva matriculación
  async createEnrollmentNotification(userId: string, enrollmentData: any) {
    return this.create({
      userId,
      type: NotificationType.ENROLLMENT_CREATED,
      payload: {
        courseTitle: enrollmentData.courseTitle,
        courseId: enrollmentData.courseId,
        enrolledAt: new Date().toISOString(),
      },
    });
  }

  // ========== QUERY NOTIFICATIONS ==========

  // Obtener notificaciones con filtros
  async findAll(query: QueryNotificationsDto): Promise<NotificationSummaryDto> {
    const {
      page = 1,
      limit = 10,
      userId,
      type,
      unreadOnly,
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Prisma.NotificationWhereInput = {
      ...(userId && { userId }),
      ...(type && { type }),
      ...(unreadOnly && { readAt: null }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: sortOrder },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);

    return {
      total,
      unread: unreadCount,
      notifications: notifications.map(
        ({ user, ...notification }) => notification,
      ),
    };
  }

  // Obtener notificaciones de un usuario específico
  async findByUserId(userId: string, unreadOnly: boolean = false) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { readAt: null }),
    };

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: 20, // Últimas 20 notificaciones
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  // Contar notificaciones no leídas
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  // ========== MARK AS READ ==========

  // Marcar notificaciones como leídas
  async markAsRead(markAsReadDto: MarkAsReadDto, userId: string) {
    const { notificationIds } = markAsReadDto;

    // Verificar que las notificaciones pertenecen al usuario
    const notifications = await this.prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
    });

    if (notifications.length !== notificationIds.length) {
      throw new BadRequestException(
        'Some notifications not found or not owned by user',
      );
    }

    // Marcar como leídas
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
        readAt: null, // Solo marcar las que no están leídas
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      message: `${result.count} notifications marked as read`,
      markedCount: result.count,
    };
  }

  // Marcar todas como leídas
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      message: `All notifications marked as read`,
      markedCount: result.count,
    };
  }

  // ========== DELETE NOTIFICATIONS ==========

  // Eliminar notificación específica
  async remove(id: string, userId?: string): Promise<Notification> {
    // Verificar que existe
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Si se proporciona userId, verificar que es del usuario
    if (userId && notification.userId !== userId) {
      throw new BadRequestException('Notification does not belong to user');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  // Limpiar notificaciones antiguas (opcional - para mantenimiento)
  async cleanupOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notification.deleteMany({
      where: {
        sentAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      message: `Deleted ${result.count} notifications older than ${daysOld} days`,
      deletedCount: result.count,
    };
  }
}
