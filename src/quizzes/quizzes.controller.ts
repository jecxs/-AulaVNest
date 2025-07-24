// quizzes/quizzes.controller.ts
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
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  // POST /quizzes - Crear quiz (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createQuizDto: CreateQuizDto, @CurrentUser() user: any) {
    return this.quizzesService.create(createQuizDto);
  }

  // GET /quizzes - Listar quizzes con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryQuizzesDto) {
    return this.quizzesService.findAll(query);
  }

  // GET /quizzes/stats - Estadísticas de quizzes (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.quizzesService.getQuizStats();
  }

  // GET /quizzes/module/:moduleId - Quizzes de un módulo específico
  @Get('module/:moduleId')
  @UseGuards(JwtAuthGuard)
  async findByModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: any,
  ) {
    // Verificar acceso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.quizzesService.checkUserAccessToModule(
        moduleId,
        user.id,
        user.roles,
      );
    }

    return this.quizzesService.findByModule(
      moduleId,
      user.roles.includes(RoleName.ADMIN),
    );
  }

  // GET /quizzes/:id - Obtener quiz por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // Verificar acceso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.quizzesService.checkUserAccessToQuiz(id, user.id, user.roles);
      // Retornar versión para estudiante
      return this.quizzesService.findOneForStudent(id);
    }

    return this.quizzesService.findOne(id);
  }

  // GET /quizzes/:id/preview - Vista previa para estudiantes (con preguntas pero sin respuestas)
  @Get(':id/preview')
  @UseGuards(JwtAuthGuard)
  async getQuizPreview(@Param('id') id: string, @CurrentUser() user: any) {
    // Verificar acceso
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.quizzesService.checkUserAccessToQuiz(id, user.id, user.roles);
    }

    return this.quizzesService.getQuizPreview(id);
  }

  // POST /quizzes/:id/submit - Enviar respuestas de quiz
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id') quizId: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @CurrentUser() user: any,
  ) {
    // Validar que el quizId coincida
    if (submitQuizDto.quizId !== quizId) {
      throw new BadRequestException('Quiz ID mismatch');
    }

    // Verificar acceso
    await this.quizzesService.checkUserAccessToQuiz(
      quizId,
      user.id,
      user.roles,
    );

    return this.quizzesService.submitQuiz(submitQuizDto, user.id);
  }

  // GET /quizzes/:id/results/:userId - Ver resultados de un quiz (Solo ADMIN o propio usuario)
  @Get(':id/results/:userId')
  @UseGuards(JwtAuthGuard)
  async getQuizResults(
    @Param('id') quizId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    // Solo admin o el propio usuario puede ver resultados
    if (!user.roles.includes(RoleName.ADMIN) && user.id !== userId) {
      throw new BadRequestException('You can only view your own results');
    }

    return this.quizzesService.getQuizResults(quizId, userId);
  }

  // PATCH /quizzes/:id - Actualizar quiz (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(@Param('id') id: string, @Body() updateQuizDto: UpdateQuizDto) {
    return this.quizzesService.update(id, updateQuizDto);
  }

  // POST /quizzes/:id/duplicate - Duplicar quiz a otro módulo (Solo ADMIN)
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id') id: string,
    @Body('targetModuleId') targetModuleId: string,
  ) {
    if (!targetModuleId) {
      throw new BadRequestException('Target module ID is required');
    }

    return this.quizzesService.duplicateQuiz(id, targetModuleId);
  }

  // DELETE /quizzes/:id - Eliminar quiz (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.quizzesService.remove(id);
  }
}
