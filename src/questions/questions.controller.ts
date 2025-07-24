// questions/questions.controller.ts - ACTUALIZADO
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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  CreateQuestionSimpleDto,
  CreateQuestionWithImageDto,
} from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  CreateAnswerOptionSimpleDto,
  UpdateAnswerOptionDto,
} from './dto/answer-option.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // ========== QUESTION ENDPOINTS ==========

  // POST /questions - Crear pregunta completa con opciones (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createQuestionDto: CreateQuestionDto,
    @CurrentUser() user: any,
  ) {
    return this.questionsService.create(createQuestionDto);
  }

  // POST /questions/simple - Crear pregunta sin opciones (Solo ADMIN)
  @Post('simple')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createSimple(
    @Body() createQuestionDto: CreateQuestionSimpleDto,
    @CurrentUser() user: any,
  ) {
    return this.questionsService.createSimple(createQuestionDto);
  }

  // 👈 NUEVO: POST /questions/upload-with-image - Crear pregunta con imagen
  @Post('upload-with-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo para imágenes
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        // Tipos de imagen permitidos
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPEG, PNG, GIF, and WebP images are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createWithImage(
    @Body() createQuestionDto: CreateQuestionWithImageDto,
    @UploadedFile() imageFile: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!imageFile) {
      throw new BadRequestException('Image file is required');
    }

    return this.questionsService.createWithImage(createQuestionDto, imageFile);
  }

  // 👈 NUEVO: PATCH /questions/:id/upload-image - Agregar/actualizar imagen a pregunta existente
  @Patch(':id/upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPEG, PNG, GIF, and WebP images are allowed',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() imageFile: Express.Multer.File,
  ) {
    if (!imageFile) {
      throw new BadRequestException('Image file is required');
    }

    return this.questionsService.uploadImageToQuestion(id, imageFile);
  }

  // 👈 NUEVO: DELETE /questions/:id/remove-image - Eliminar imagen de pregunta
  @Delete(':id/remove-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeImage(@Param('id') id: string) {
    return this.questionsService.removeImageFromQuestion(id);
  }

  // GET /questions - Listar preguntas con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryQuestionsDto) {
    return this.questionsService.findAll(query);
  }

  // GET /questions/stats - Estadísticas de preguntas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.questionsService.getQuestionStats();
  }

  // GET /questions/quiz/:quizId - Preguntas de un quiz específico
  @Get('quiz/:quizId')
  @UseGuards(JwtAuthGuard)
  async findByQuiz(@Param('quizId') quizId: string, @CurrentUser() user: any) {
    // Verificar acceso
    await this.questionsService.checkUserAccessToQuiz(
      quizId,
      user.id,
      user.roles,
    );

    return this.questionsService.findByQuiz(
      quizId,
      user.roles.includes(RoleName.ADMIN),
    );
  }

  // GET /questions/quiz/:quizId/next-order - Siguiente orden disponible
  @Get('quiz/:quizId/next-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getNextOrder(@Param('quizId') quizId: string) {
    const nextOrder = await this.questionsService.getNextOrderForQuiz(quizId);
    return { nextOrder };
  }

  // GET /questions/:id - Obtener pregunta por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  // PATCH /questions/:id - Actualizar pregunta (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  // POST /questions/:id/duplicate - Duplicar pregunta a otro quiz (Solo ADMIN)
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id') id: string,
    @Body('targetQuizId') targetQuizId: string,
  ) {
    if (!targetQuizId) {
      throw new BadRequestException('Target quiz ID is required');
    }

    return this.questionsService.duplicateQuestion(id, targetQuizId);
  }

  // PATCH /questions/quiz/:quizId/reorder - Reordenar preguntas (Solo ADMIN)
  @Patch('quiz/:quizId/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reorderQuestions(
    @Param('quizId') quizId: string,
    @Body() reorderDto: ReorderQuestionsDto,
  ) {
    return this.questionsService.reorderQuestions(quizId, reorderDto);
  }

  // DELETE /questions/:id - Eliminar pregunta (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }

  // ========== ANSWER OPTIONS ENDPOINTS ==========

  // POST /questions/:questionId/answer-options - Agregar opción (Solo ADMIN)
  @Post(':questionId/answer-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addAnswerOption(
    @Param('questionId') questionId: string,
    @Body() createAnswerOptionDto: CreateAnswerOptionSimpleDto,
  ) {
    // Asegurar que questionId coincida
    createAnswerOptionDto.questionId = questionId;
    return this.questionsService.addAnswerOption(createAnswerOptionDto);
  }

  // GET /questions/:questionId/answer-options - Obtener opciones de una pregunta (Solo ADMIN)
  @Get(':questionId/answer-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getAnswerOptions(@Param('questionId') questionId: string) {
    return this.questionsService.getAnswerOptions(questionId);
  }

  // PATCH /questions/answer-options/:id - Actualizar opción (Solo ADMIN)
  @Patch('answer-options/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async updateAnswerOption(
    @Param('id') id: string,
    @Body() updateAnswerOptionDto: UpdateAnswerOptionDto,
  ) {
    return this.questionsService.updateAnswerOption(id, updateAnswerOptionDto);
  }

  // DELETE /questions/answer-options/:id - Eliminar opción (Solo ADMIN)
  @Delete('answer-options/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeAnswerOption(@Param('id') id: string) {
    return this.questionsService.removeAnswerOption(id);
  }
}
