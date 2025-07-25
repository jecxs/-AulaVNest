// live-sessions/live-sessions.controller.ts
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
  BadRequestException,
} from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { CreateBulkLiveSessionsDto } from './dto/bulk-live-sessions.dto';
import { UpdateLiveSessionDto } from './dto/update-live-session.dto';
import {
  QueryLiveSessionsDto,
  LiveSessionStatus,
} from './dto/query-live-sessions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  // ========== CRUD BÁSICO ==========

  // POST /live-sessions - Crear sesión en vivo (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createLiveSessionDto: CreateLiveSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.liveSessionsService.create(createLiveSessionDto);
  }

  // POST /live-sessions/bulk - Crear múltiples sesiones (Solo ADMIN)
  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @Body() createBulkDto: CreateBulkLiveSessionsDto,
    @CurrentUser() user: any,
  ) {
    return this.liveSessionsService.createBulkSessions(createBulkDto);
  }

  // GET /live-sessions - Listar sesiones con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryLiveSessionsDto) {
    return this.liveSessionsService.findAll(query);
  }

  // GET /live-sessions/my-sessions - Sesiones del usuario actual
  @Get('my-sessions')
  @UseGuards(JwtAuthGuard)
  async getMySessions(
    @CurrentUser() user: any,
    @Query() query: QueryLiveSessionsDto,
  ) {
    return this.liveSessionsService.getUserSessions(user.id, query);
  }

  // GET /live-sessions/upcoming - Próximas sesiones (todas o del usuario)
  @Get('upcoming')
  @UseGuards(JwtAuthGuard)
  async getUpcomingSessions(
    @CurrentUser() user: any,
    @Query() query: QueryLiveSessionsDto,
  ) {
    if (user.roles.includes(RoleName.ADMIN)) {
      return this.liveSessionsService.findAll({
        ...query,
        status: LiveSessionStatus.UPCOMING,
      });
    }

    return this.liveSessionsService.getUserSessions(user.id, {
      ...query,
      status: LiveSessionStatus.UPCOMING,
    });
  }

  // GET /live-sessions/live-now - Sesiones en vivo actualmente
  @Get('live-now')
  @UseGuards(JwtAuthGuard)
  async getLiveNowSessions(@CurrentUser() user: any) {
    if (user.roles.includes(RoleName.ADMIN)) {
      return this.liveSessionsService.getCurrentLiveSessions();
    }

    return this.liveSessionsService.getUserCurrentLiveSessions(user.id);
  }

  // GET /live-sessions/stats - Estadísticas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.liveSessionsService.getLiveSessionStats();
  }

  // GET /live-sessions/course/:courseId - Sesiones de un curso específico
  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard)
  async getCourseSessions(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Query() query: QueryLiveSessionsDto,
  ) {
    // Verificar acceso al curso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.liveSessionsService.checkUserCourseAccess(courseId, user.id);
    }

    return this.liveSessionsService.getCourseSessions(courseId, query, user);
  }

  // GET /live-sessions/next/:courseId - Próxima sesión de un curso
  @Get('next/:courseId')
  @UseGuards(JwtAuthGuard)
  async getNextCourseSession(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.liveSessionsService.checkUserCourseAccess(courseId, user.id);
    }

    return this.liveSessionsService.getNextCourseSession(courseId);
  }

  // GET /live-sessions/calendar - Vista calendario (próximos 30 días)
  @Get('calendar')
  @UseGuards(JwtAuthGuard)
  async getCalendarView(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    const daysNumber = days ? parseInt(days, 10) : 30;

    if (user.roles.includes(RoleName.ADMIN)) {
      return this.liveSessionsService.getCalendarView(daysNumber);
    }

    return this.liveSessionsService.getUserCalendarView(user.id, daysNumber);
  }

  // GET /live-sessions/:id - Obtener sesión por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const session = await this.liveSessionsService.findOne(id);

    // Verificar acceso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.liveSessionsService.checkUserCourseAccess(
        session.courseId,
        user.id,
      );
      return this.liveSessionsService.getSessionForStudent(id, user.id);
    }

    return session;
  }

  // PATCH /live-sessions/:id - Actualizar sesión (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateLiveSessionDto: UpdateLiveSessionDto,
  ) {
    return this.liveSessionsService.update(id, updateLiveSessionDto);
  }

  // PATCH /live-sessions/:id/start - Marcar sesión como iniciada (Solo ADMIN)
  @Patch(':id/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async startSession(@Param('id') id: string) {
    return this.liveSessionsService.markSessionAsStarted(id);
  }

  // PATCH /live-sessions/:id/end - Marcar sesión como finalizada (Solo ADMIN)
  @Patch(':id/end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async endSession(@Param('id') id: string) {
    return this.liveSessionsService.markSessionAsEnded(id);
  }

  // POST /live-sessions/:id/join - Unirse a sesión (verificar acceso)
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async joinSession(@Param('id') id: string, @CurrentUser() user: any) {
    return this.liveSessionsService.joinSession(id, user.id);
  }

  // DELETE /live-sessions/:id - Eliminar sesión (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.liveSessionsService.remove(id);
  }

  // DELETE /live-sessions/course/:courseId/cleanup - Limpiar sesiones pasadas
  @Delete('course/:courseId/cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupPastSessions(
    @Param('courseId') courseId: string,
    @Query('days') days?: string,
  ) {
    const daysNumber = days ? parseInt(days, 10) : 30;
    return this.liveSessionsService.cleanupPastSessions(courseId, daysNumber);
  }
}
