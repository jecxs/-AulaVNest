// students/students.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentProfileResponseDto } from './dto/student-profile-response.dto';

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /**
   * GET /students/profile
   * Obtener perfil completo del estudiante actual
   * Este endpoint devuelve toda la información necesaria para la vista de perfil
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getMyProfile(
    @CurrentUser() user: any,
  ): Promise<StudentProfileResponseDto> {
    return this.studentsService.getStudentProfile(user.id);
  }

  /**
   * GET /students/stats
   * Obtener solo las estadísticas rápidas del estudiante
   * Útil para dashboards o widgets que no necesitan toda la información
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getMyStats(@CurrentUser() user: any) {
    return this.studentsService.getStudentStats(user.id);
  }
}
