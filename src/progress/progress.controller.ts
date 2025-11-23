// progress/progress.controller.ts - SIMPLIFICADO
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CreateProgressDto } from './dto/create-progress.dto';
import { MarkLessonCompleteDto } from './dto/mark-lesson-complete.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // ========== ENDPOINTS PARA ESTUDIANTES ==========

  /**
   * POST /progress/mark-complete
   * Marcar lección como completada - ENDPOINT PRINCIPAL
   * El estudiante hace click en "Completar y Continuar" y llama este endpoint
   */
  @Post('mark-complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async markLessonComplete(
    @Body() markLessonCompleteDto: MarkLessonCompleteDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.markLessonComplete(
      user.id,
      markLessonCompleteDto,
    );
  }

  /**
   * GET /progress/my-progress
   * Obtener resumen completo del progreso del estudiante
   */
  @Get('my-progress')
  @UseGuards(JwtAuthGuard)
  async getMyProgress(@CurrentUser() user: any) {
    return this.progressService.getUserProgressSummary(user.id);
  }

  /**
   * GET /progress/my-course/:courseId
   * Obtener progreso del estudiante en un curso específico
   */
  @Get('my-course/:courseId')
  @UseGuards(JwtAuthGuard)
  async getMyCourseProgress(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getUserCourseProgress(user.id, courseId);
  }

  /**
   * GET /progress/check/:lessonId
   * Verificar si una lección está completada
   */
  @Get('check/:lessonId')
  @UseGuards(JwtAuthGuard)
  async checkLessonProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.checkLessonProgress(user.id, lessonId);
  }

  /**
   * GET /progress/next-lesson/:courseId
   * Obtener siguiente lección por completar en un curso
   */
  @Get('next-lesson/:courseId')
  @UseGuards(JwtAuthGuard)
  async getNextLesson(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getNextLessonToComplete(user.id, courseId);
  }

  /**
   * GET /progress/module/:moduleId
   * Obtener progreso detallado de un módulo
   */
  @Get('module/:moduleId')
  @UseGuards(JwtAuthGuard)
  async getModuleProgress(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getModuleProgress(user.id, moduleId);
  }

  // ========== ENDPOINTS PARA ADMIN (CORRECCIONES) ==========

  /**
   * POST /progress
   * Crear progreso manualmente (solo para correcciones)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProgressDto: CreateProgressDto) {
    return this.progressService.create(createProgressDto);
  }

  /**
   * GET /progress/:id
   * Obtener progress por ID (admin o propio estudiante)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const progress = await this.progressService.findOne(id);

    const enrollment = await this.progressService.getProgressEnrollment(
      progress.enrollmentId,
    );

    if (!user.roles.includes(RoleName.ADMIN) && enrollment.userId !== user.id) {
      throw new BadRequestException('You can only view your own progress');
    }

    return progress;
  }

  /**
   * PATCH /progress/:id/mark-incomplete
   * Marcar lección como no completada (solo admin, para correcciones)
   */
  @Patch(':id/mark-incomplete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async markIncomplete(@Param('id') id: string) {
    return this.progressService.markLessonIncomplete(id);
  }

  /**
   * POST /progress/reset-course/:courseId/:userId
   * Resetear todo el progreso de un curso (solo admin)
   */
  @Post('reset-course/:courseId/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetCourseProgress(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ) {
    return this.progressService.resetCourseProgress(userId, courseId);
  }

  /**
   * POST /progress/reset-lesson/:lessonId/:userId
   * Resetear progreso de una lección específica (solo admin)
   */
  @Post('reset-lesson/:lessonId/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetLessonProgress(
    @Param('lessonId') lessonId: string,
    @Param('userId') userId: string,
  ) {
    return this.progressService.resetLessonProgress(userId, lessonId);
  }

  /**
   * DELETE /progress/:id
   * Eliminar progress (solo admin, para correcciones)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.progressService.remove(id);
  }
}
