// live-sessions/live-sessions-scheduler.service.ts - NUEVO ARCHIVO

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LiveSessionsSchedulerService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ⏰ Ejecutar cada 10 minutos para verificar sesiones próximas
  @Cron('0 */10 * * * *')
  async checkUpcomingSessions() {
    console.log('🔍 Checking for upcoming live sessions...');

    const now = new Date();
    // Verificar sesiones que empiezan en los próximos 30 minutos
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

    try {
      const upcomingSessions = await this.prisma.liveSession.findMany({
        where: {
          startsAt: {
            gte: now,
            lte: in30Minutes,
          },
        },
        include: {
          course: {
            include: {
              enrollments: {
                where: {
                  status: 'ACTIVE',
                  paymentConfirmed: true, // Solo estudiantes con pago confirmado
                },
                select: {
                  userId: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (upcomingSessions.length === 0) {
        console.log('✅ No upcoming sessions found');
        return;
      }

      let totalNotifications = 0;

      // Procesar cada sesión próxima
      for (const session of upcomingSessions) {
        console.log(`📺 Processing session: ${session.topic} - ${session.startsAt}`);

        // Verificar si ya enviamos notificaciones para esta sesión
        const existingNotifications = await this.prisma.notification.count({
          where: {
            type: 'LIVE_SESSION_REMINDER',
            payload: {
              path: ['sessionId'],
              equals: session.id,
            },
          },
        });

        if (existingNotifications > 0) {
          console.log(`⏭️  Notifications already sent for session ${session.id}`);
          continue;
        }

        // Enviar notificaciones a todos los estudiantes matriculados
        for (const enrollment of session.course.enrollments) {
          try {
            await this.notificationsService.createLiveSessionReminderNotification(
              enrollment.userId,
              {
                sessionId: session.id, // Agregar ID para tracking
                topic: session.topic,
                startsAt: session.startsAt,
                courseName: session.course.title,
                meetingUrl: session.meetingUrl,
              },
            );

            totalNotifications++;
          } catch (error) {
            console.error(
              `❌ Failed to send notification to user ${enrollment.userId}:`,
              error.message,
            );
          }
        }

        console.log(
          `✅ Sent ${session.course.enrollments.length} notifications for session: ${session.topic}`,
        );
      }

      console.log(`🎉 Total live session notifications sent: ${totalNotifications}`);
    } catch (error) {
      console.error('❌ Error checking upcoming sessions:', error);
    }
  }

  // 🧹 Método para limpiar notificaciones de sesiones pasadas (ejecutar diariamente)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldSessionNotifications() {
    console.log('🧹 Cleaning up old live session notifications...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await this.prisma.notification.deleteMany({
        where: {
          type: 'LIVE_SESSION_REMINDER',
          sentAt: {
            lt: yesterday,
          },
        },
      });

      console.log(`🗑️  Deleted ${result.count} old live session notifications`);
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
    }
  }

  // 📊 Método manual para verificar próximas sesiones (útil para testing)
  async getUpcomingSessionsPreview() {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const upcomingSessions = await this.prisma.liveSession.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: in2Hours,
        },
      },
      include: {
        course: {
          select: {
            title: true,
            _count: {
              select: {
                enrollments: {
                  where: {
                    status: 'ACTIVE',
                    paymentConfirmed: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      currentTime: now,
      sessionsFound: upcomingSessions.length,
      sessions: upcomingSessions.map(session => ({
        id: session.id,
        topic: session.topic,
        startsAt: session.startsAt,
        courseName: session.course.title,
        enrolledStudents: session.course._count.enrollments,
        minutesUntilStart: Math.floor((session.startsAt.getTime() - now.getTime()) / (1000 * 60)),
      })),
    };
  }
}