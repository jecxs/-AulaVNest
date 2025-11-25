// live-sessions/live-sessions.controller.ts - VERSIÓN SIMPLIFICADA

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
  ForbiddenException,
} from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('live-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  // ========== ENDPOINTS PARA ADMIN ==========

  /**
   * POST /live-sessions
   * Crear una nueva sesión en vivo (Solo ADMIN)
   */
  @Post()
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateLiveSessionDto) {
    return this.liveSessionsService.create(createDto);
  }

  /**
   * GET /live-sessions
   * Listar todas las sesiones (Solo ADMIN)
   * Query opcional: ?courseId=xxx
   */
  @Get()
  @Roles(RoleName.ADMIN)
  async findAll(@Query('courseId') courseId?: string) {
    return this.liveSessionsService.findAll(courseId);
  }

  /**
   * GET /live-sessions/:id
   * Obtener una sesión por ID (ADMIN o estudiante con acceso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const session = await this.liveSessionsService.findOne(id);

    // Si es estudiante, verificar que tenga acceso al curso
    if (!user.roles.includes(RoleName.ADMIN)) {
      const hasAccess = await this.liveSessionsService.checkStudentCourseAccess(
        session.courseId,
        user.id,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes acceso a este curso',
        );
      }
    }

    return session;
  }

  /**
   * PATCH /live-sessions/:id
   * Actualizar una sesión (Solo ADMIN)
   */
  @Patch(':id')
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLiveSessionDto,
  ) {
    return this.liveSessionsService.update(id, updateDto);
  }

  /**
   * DELETE /live-sessions/:id
   * Eliminar una sesión (Solo ADMIN)
   */
  @Delete(':id')
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.liveSessionsService.remove(id);
  }

  // ========== ENDPOINTS PARA ESTUDIANTES ==========

  /**
   * GET /live-sessions/my-sessions
   * Obtener todas las sesiones de los cursos del estudiante
   */
  @Get('my-sessions')
  async getMySessions(@CurrentUser() user: any) {
    // Si es admin, puede ver todas
    if (user.roles.includes(RoleName.ADMIN)) {
      return this.liveSessionsService.findAll();
    }

    return this.liveSessionsService.getStudentSessions(user.id);
  }

  /**
   * GET /live-sessions/my-upcoming
   * Obtener solo las próximas sesiones del estudiante
   */
  @Get('my-upcoming')
  async getMyUpcomingSessions(@CurrentUser() user: any) {
    return this.liveSessionsService.getStudentUpcomingSessions(user.id);
  }

  /**
   * GET /live-sessions/course/:courseId
   * Obtener sesiones de un curso específico
   * (estudiante con acceso o admin)
   */
  @Get('course/:courseId')
  async getCourseSessions(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    // Si es estudiante, verificar acceso
    if (!user.roles.includes(RoleName.ADMIN)) {
      const hasAccess = await this.liveSessionsService.checkStudentCourseAccess(
        courseId,
        user.id,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes acceso a este curso',
        );
      }
    }

    return this.liveSessionsService.getCourseSessions(courseId);
  }
}