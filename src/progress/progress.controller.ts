// progress/progress.controller.ts - CORREGIDO
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
import { ProgressService } from './progress.service';
import { CreateProgressDto } from './dto/create-progress.dto';
import { MarkLessonCompleteDto } from './dto/mark-lesson-complete.dto'; // ← CORREGIDO: Eliminar punto y coma extra
import { BulkProgressDto } from './dto/bulk-progress.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { QueryProgressDto } from './dto/query-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';
import {
  LessonViewDto,
  NavigationDto,
  StartLessonDto,
  VideoProgressDto,
} from './dto/lesson-tracking.dto';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // ========== PROGRESS CREATION ==========

  // POST /progress/start-lesson - Solo registrar inicio (sin crear progress aún)
  @Post('start-lesson')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startLesson(
    @Body() startLessonDto: StartLessonDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.startLessonSession(
      user.id,
      startLessonDto.lessonId,
    );
  }

  // POST /progress/video-checkpoint - Solo para videos al llegar a 85%
  @Post('video-checkpoint')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async videoCheckpoint(
    @Body() videoProgressDto: VideoProgressDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.handleVideoCheckpoint(
      user.id,
      videoProgressDto,
    );
  }
  // POST /progress/lesson-exit - Al salir de lección (texto/PDF)
  @Post('lesson-exit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async lessonExit(@Body() viewDto: LessonViewDto, @CurrentUser() user: any) {
    return this.progressService.handleLessonExit(user.id, viewDto);
  }

  // POST /progress/navigate - Al navegar entre lecciones
  @Post('navigate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleNavigation(
    @Body() navigationDto: NavigationDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.handleLessonNavigation(
      user.id,
      navigationDto.fromLessonId,
      navigationDto.toLessonId,
    );
  }

  // POST /progress - Crear progress directo (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProgressDto: CreateProgressDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.create(createProgressDto);
  }

  // POST /progress/mark-complete - Marcar lesson como completada (Estudiante)
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

  // POST /progress/bulk - Marcar múltiples lessons como completadas (Solo ADMIN)
  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async bulkMarkComplete(
    @Body() bulkProgressDto: BulkProgressDto,
    @CurrentUser() user: any,
  ) {
    return this.progressService.bulkMarkComplete(bulkProgressDto);
  }

  // ========== PROGRESS QUERIES ==========

  // GET /progress - Listar progress con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryProgressDto) {
    return this.progressService.findAll(query);
  }

  // GET /progress/my-progress - Progreso del usuario actual
  @Get('my-progress')
  @UseGuards(JwtAuthGuard)
  async getMyProgress(
    @CurrentUser() user: any,
    @Query() query: QueryProgressDto,
  ) {
    return this.progressService.getUserProgress(user.id, query);
  }

  // GET /progress/stats - Estadísticas generales de progress (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.progressService.getProgressStats();
  }

  // ========== PROGRESS BY USER/COURSE/LESSON ==========

  // GET /progress/user/:userId - Progress de un usuario específico (Solo ADMIN)
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getUserProgress(
    @Param('userId') userId: string,
    @Query() query: QueryProgressDto,
  ) {
    return this.progressService.getUserProgress(userId, query);
  }

  // GET /progress/user/:userId/summary - Resumen completo del usuario
  @Get('user/:userId/summary')
  @UseGuards(JwtAuthGuard)
  async getUserProgressSummary(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    // Solo admin o el propio usuario puede ver el resumen
    if (!user.roles.includes(RoleName.ADMIN) && user.id !== userId) {
      throw new BadRequestException('You can only view your own progress');
    }

    return this.progressService.getUserProgressSummary(userId);
  }

  // GET /progress/course/:courseId - Progress de un curso específico (Solo ADMIN)
  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getCourseProgress(
    @Param('courseId') courseId: string,
    @Query() query: QueryProgressDto,
  ) {
    return this.progressService.getCourseProgress(courseId, query);
  }

  // GET /progress/course/:courseId/summary - Resumen del curso
  @Get('course/:courseId/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getCourseProgressSummary(@Param('courseId') courseId: string) {
    return this.progressService.getCourseProgressSummary(courseId);
  }

  // GET /progress/my-course/:courseId - Mi progreso en un curso específico
  @Get('my-course/:courseId')
  @UseGuards(JwtAuthGuard)
  async getMyCourseProgress(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getUserCourseProgress(user.id, courseId);
  }

  // GET /progress/lesson/:lessonId - Progress de una lesson específica (Solo ADMIN)
  @Get('lesson/:lessonId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getLessonProgress(@Param('lessonId') lessonId: string) {
    return this.progressService.getLessonProgressStats(lessonId);
  }

  // GET /progress/enrollment/:enrollmentId - Progress de un enrollment específico
  @Get('enrollment/:enrollmentId')
  @UseGuards(JwtAuthGuard)
  async getEnrollmentProgress(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getEnrollmentProgress(enrollmentId, user);
  }

  // ========== PROGRESS VERIFICATION ==========

  // GET /progress/check/:lessonId - Verificar si lesson está completada
  @Get('check/:lessonId')
  @UseGuards(JwtAuthGuard)
  async checkLessonProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.checkLessonProgress(user.id, lessonId);
  }

  // GET /progress/next-lesson/:courseId - Obtener siguiente lesson por completar
  @Get('next-lesson/:courseId')
  @UseGuards(JwtAuthGuard)
  async getNextLesson(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.progressService.getNextLessonToComplete(user.id, courseId);
  }

  // ========== INDIVIDUAL PROGRESS OPERATIONS ==========

  // GET /progress/:id - Obtener progress por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const progress = await this.progressService.findOne(id);

    // ← CORREGIDO: Verificar acceso usando el enrollmentId para obtener el user
    const enrollment = await this.progressService.getProgressEnrollment(
      progress.enrollmentId,
    );

    if (!user.roles.includes(RoleName.ADMIN) && enrollment.userId !== user.id) {
      throw new BadRequestException('You can only view your own progress');
    }

    return progress;
  }

  // PATCH /progress/:id - Actualizar progress (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ) {
    return this.progressService.update(id, updateProgressDto);
  }

  // PATCH /progress/:id/mark-incomplete - Marcar lesson como no completada
  @Patch(':id/mark-incomplete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async markIncomplete(@Param('id') id: string) {
    return this.progressService.markLessonIncomplete(id);
  }

  // ========== PROGRESS ANALYTICS ==========

  // GET /progress/analytics/completion-rates - Tasas de finalización por curso
  @Get('analytics/completion-rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getCompletionRates() {
    return this.progressService.getCompletionRatesByourse();
  }

  // GET /progress/analytics/student-performance - Rendimiento de estudiantes
  @Get('analytics/student-performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStudentPerformance(@Query('courseId') courseId?: string) {
    return this.progressService.getStudentPerformanceAnalytics(courseId);
  }

  // GET /progress/analytics/lesson-difficulty - Análisis de dificultad por lesson
  @Get('analytics/lesson-difficulty')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getLessonDifficulty(@Query('courseId') courseId?: string) {
    return this.progressService.getLessonDifficultyAnalysis(courseId);
  }

  // ========== PROGRESS MANAGEMENT ==========

  // POST /progress/reset-course/:courseId/:userId - Resetear progreso de curso
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

  // POST /progress/reset-lesson/:lessonId/:userId - Resetear progreso de lesson
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

  // DELETE /progress/:id - Eliminar progress (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.progressService.remove(id);
  }

  // POST /progress/auto-complete-video/:lessonId - Auto-completar lesson de video
  @Post('auto-complete-video/:lessonId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async autoCompleteVideoLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: any,
  ) {
    // Solo para lessons de tipo VIDEO que el usuario ha "visto"
    return this.progressService.autoCompleteVideoLesson(user.id, lessonId);
  }
}
