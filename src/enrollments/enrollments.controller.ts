// enrollments/enrollments.controller.ts
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
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { CreateManualEnrollmentDto } from './dto/create-manual-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // ========== ENROLLMENT CREATION ==========

  // POST /enrollments - Crear enrollment directo (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @CurrentUser() user: any,
  ) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  // POST /enrollments/manual - Enrollar usuario por email (Solo ADMIN)
  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createManual(
    @Body() createManualEnrollmentDto: CreateManualEnrollmentDto,
    @CurrentUser() user: any,
  ) {
    return this.enrollmentsService.createManualEnrollment(
      createManualEnrollmentDto,
      user.id,
    );
  }

  // POST /enrollments/bulk - Enrollment masivo (Solo ADMIN)
  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async bulkEnrollment(
    @Body() bulkEnrollmentDto: BulkEnrollmentDto,
    @CurrentUser() user: any,
  ) {
    return this.enrollmentsService.bulkEnrollment(bulkEnrollmentDto, user.id);
  }

  // ========== ENROLLMENT QUERIES ==========

  // GET /enrollments - Listar enrollments con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findAll(query);
  }

  // GET /enrollments/stats - Estadísticas de enrollments (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.enrollmentsService.getEnrollmentStats();
  }

  // GET /enrollments/pending-payment - Enrollments pendientes de pago (Solo ADMIN)
  @Get('pending-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findPendingPayment(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findPendingPayment(query);
  }

  // GET /enrollments/expired - Enrollments expirados (Solo ADMIN)
  @Get('expired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findExpired(@Query() query: QueryEnrollmentsDto) {
    return this.enrollmentsService.findExpired(query);
  }

  // GET /enrollments/expiring-soon - Enrollments que expiran pronto (Solo ADMIN)
  @Get('expiring-soon')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findExpiringSoon(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 7;
    return this.enrollmentsService.findExpiringSoon(daysNumber);
  }

  // ========== ENROLLMENT BY USER/COURSE ==========

  // GET /enrollments/my-courses - Cursos del usuario actual
  @Get('my-courses')
  @UseGuards(JwtAuthGuard)
  async getMyEnrollments(
    @CurrentUser() user: any,
    @Query() query: QueryEnrollmentsDto,
  ) {
    return this.enrollmentsService.getUserEnrollments(user.id, query);
  }

  // GET /enrollments/user/:userId - Enrollments de un usuario específico
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getUserEnrollments(
    @Param('userId') userId: string,
    @Query() query: QueryEnrollmentsDto,
  ) {
    return this.enrollmentsService.getUserEnrollments(userId, query);
  }

  // GET /enrollments/course/:courseId - Enrollments de un curso específico
  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getCourseEnrollments(
    @Param('courseId') courseId: string,
    @Query() query: QueryEnrollmentsDto,
  ) {
    return this.enrollmentsService.getCourseEnrollments(courseId, query);
  }

  // GET /enrollments/course/:courseId/stats - Estadísticas de un curso
  @Get('course/:courseId/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getCourseEnrollmentStats(@Param('courseId') courseId: string) {
    return this.enrollmentsService.getCourseEnrollmentStats(courseId);
  }

  // ========== INDIVIDUAL ENROLLMENT OPERATIONS ==========

  // GET /enrollments/:id - Obtener enrollment por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const enrollment = await this.enrollmentsService.findOne(id);

    // Verificar acceso: admin o el propio usuario enrollado
    if (!user.roles.includes(RoleName.ADMIN) && enrollment.userId !== user.id) {
      throw new BadRequestException('You can only view your own enrollments');
    }

    return enrollment;
  }

  // PATCH /enrollments/:id - Actualizar enrollment (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  // ========== ENROLLMENT STATUS MANAGEMENT ==========

  // PATCH /enrollments/:id/confirm-payment - Confirmar pago (Solo ADMIN)
  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Param('id') id: string) {
    return this.enrollmentsService.confirmPayment(id);
  }

  // PATCH /enrollments/:id/activate - Activar enrollment (Solo ADMIN)
  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.enrollmentsService.activateEnrollment(id);
  }

  // PATCH /enrollments/:id/suspend - Suspender enrollment (Solo ADMIN)
  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    return this.enrollmentsService.suspendEnrollment(id);
  }

  // PATCH /enrollments/:id/complete - Marcar como completado (Solo ADMIN)
  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    return this.enrollmentsService.completeEnrollment(id);
  }

  // PATCH /enrollments/:id/extend - Extender fecha de expiración (Solo ADMIN)
  @Patch(':id/extend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async extend(@Param('id') id: string, @Body('months') months: number) {
    if (!months || months < 1 || months > 12) {
      throw new BadRequestException('Months must be between 1 and 12');
    }
    return this.enrollmentsService.extendEnrollment(id, months);
  }

  // ========== ENROLLMENT ACCESS VERIFICATION ==========

  // GET /enrollments/check-access/:courseId - Verificar acceso a curso
  @Get('check-access/:courseId')
  @UseGuards(JwtAuthGuard)
  async checkCourseAccess(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.enrollmentsService.checkUserAccessToCourse(courseId, user.id);
  }

  // GET /enrollments/check-access/:courseId/lesson/:lessonId - Verificar acceso a lesson
  @Get('check-access/:courseId/lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  async checkLessonAccess(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: any,
  ) {
    return this.enrollmentsService.checkUserAccessToLesson(
      courseId,
      lessonId,
      user.id,
    );
  }

  // ========== ENROLLMENT DELETION ==========

  // DELETE /enrollments/:id - Eliminar enrollment (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }

  // POST /enrollments/cleanup-expired - Limpiar enrollments expirados (Solo ADMIN)
  @Post('cleanup-expired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cleanupExpired() {
    return this.enrollmentsService.cleanupExpiredEnrollments();
  }
}
