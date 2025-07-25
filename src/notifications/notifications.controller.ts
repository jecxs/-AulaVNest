// notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ========== ADMIN ENDPOINTS ==========

  // POST /notifications - Crear notificación (Solo ADMIN)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  // GET /notifications/all - Todas las notificaciones con filtros (Solo ADMIN)
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryNotificationsDto) {
    return this.notificationsService.findAll(query);
  }

  // DELETE /notifications/cleanup/:days - Limpiar notificaciones antiguas (Solo ADMIN)
  @Delete('cleanup/:days')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupOld(@Param('days') days: string) {
    const daysNumber = parseInt(days, 10) || 30;
    return this.notificationsService.cleanupOldNotifications(daysNumber);
  }

  // ========== USER ENDPOINTS ==========

  // GET /notifications - Mis notificaciones (STUDENT o ADMIN)
  @Get()
  async getMyNotifications(
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const unreadOnlyBool = unreadOnly === 'true';
    return this.notificationsService.findByUserId(user.id, unreadOnlyBool);
  }

  // GET /notifications/unread-count - Contador de no leídas (STUDENT o ADMIN)
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  // PATCH /notifications/mark-as-read - Marcar notificaciones como leídas (STUDENT o ADMIN)
  @Patch('mark-as-read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Body() markAsReadDto: MarkAsReadDto,
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.markAsRead(markAsReadDto, user.id);
  }

  // PATCH /notifications/mark-all-read - Marcar todas como leídas (STUDENT o ADMIN)
  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  // DELETE /notifications/:id - Eliminar mi notificación (STUDENT o ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.remove(id, user.id);
  }

  // ========== ENDPOINTS PARA INTEGRACIÓN CON OTROS MÓDULOS ==========
  // Estos son para uso interno desde otros servicios, pero también pueden usarse via API

  // POST /notifications/module-completed - Notificación de módulo completado
  @Post('module-completed')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async notifyModuleCompleted(
    @Body() data: { userId: string; moduleData: any },
  ) {
    return this.notificationsService.createModuleCompletedNotification(
      data.userId,
      data.moduleData,
    );
  }

  // POST /notifications/quiz-result - Notificación de resultado de quiz
  @Post('quiz-result')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async notifyQuizResult(
    @Body() data: { userId: string; quizData: any; passed: boolean },
  ) {
    if (data.passed) {
      return this.notificationsService.createQuizPassedNotification(
        data.userId,
        data.quizData,
      );
    } else {
      return this.notificationsService.createQuizFailedNotification(
        data.userId,
        data.quizData,
      );
    }
  }

  // POST /notifications/course-completed - Notificación de curso completado
  @Post('course-completed')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async notifyCourseCompleted(
    @Body() data: { userId: string; courseData: any },
  ) {
    return this.notificationsService.createCourseCompletedNotification(
      data.userId,
      data.courseData,
    );
  }

  // POST /notifications/enrollment-created - Notificación de nueva matriculación
  @Post('enrollment-created')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async notifyEnrollmentCreated(
    @Body() data: { userId: string; enrollmentData: any },
  ) {
    return this.notificationsService.createEnrollmentNotification(
      data.userId,
      data.enrollmentData,
    );
  }

  // POST /notifications/live-session-reminder - Recordatorio de sesión en vivo
  @Post('live-session-reminder')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async notifyLiveSessionReminder(
    @Body() data: { userId: string; sessionData: any },
  ) {
    return this.notificationsService.createLiveSessionReminderNotification(
      data.userId,
      data.sessionData,
    );
  }
}
