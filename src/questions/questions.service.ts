// questions/questions.service.ts - CORREGIDO
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BunnyService } from '../shared/services/bunny.service';
import {
  Question,
  AnswerOption,
  QuestionType,
  Prisma,
  RoleName,
} from '@prisma/client';
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

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private bunnyService: BunnyService, // 👈 NUEVO: Inyectar BunnyService
  ) {}

  // ========== QUESTION METHODS ==========

  // Crear pregunta completa con opciones
  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    // Verificar que el quiz existe
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: createQuestionDto.quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Verificar que no exista otra pregunta con el mismo order
    await this.checkQuestionOrderConflict(
      createQuestionDto.quizId,
      createQuestionDto.order,
    );

    // Validar opciones según tipo de pregunta
    this.validateAnswerOptions(
      createQuestionDto.type,
      createQuestionDto.answerOptions,
    );

    try {
      return await this.prisma.question.create({
        data: {
          text: createQuestionDto.text,
          type: createQuestionDto.type,
          order: createQuestionDto.order,
          weight: createQuestionDto.weight || 1,
          imageUrl: createQuestionDto.imageUrl,
          quizId: createQuestionDto.quizId,
          answerOptions: {
            create: createQuestionDto.answerOptions,
          },
        },
        include: {
          answerOptions: true,
          quiz: {
            select: { id: true, title: true },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Question with this order already exists in the quiz',
          );
        }
      }
      throw new BadRequestException('Failed to create question');
    }
  }

  // Crear pregunta simple sin opciones
  async createSimple(
    createQuestionDto: CreateQuestionSimpleDto,
  ): Promise<Question> {
    // Verificar que el quiz existe
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: createQuestionDto.quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Verificar orden único
    await this.checkQuestionOrderConflict(
      createQuestionDto.quizId,
      createQuestionDto.order,
    );

    try {
      return await this.prisma.question.create({
        data: {
          ...createQuestionDto, // Incluye imageUrl si está presente
        },
        include: {
          answerOptions: true,
          quiz: {
            select: { id: true, title: true },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Question with this order already exists in the quiz',
          );
        }
      }
      throw new BadRequestException('Failed to create question');
    }
  }
  async createWithImage(
    createQuestionDto: CreateQuestionWithImageDto,
    imageFile: Express.Multer.File,
  ): Promise<Question> {
    try {
      // Subir imagen a Bunny.net
      const imageUrl = await this.bunnyService.uploadFile(imageFile);

      // Parsear opciones de respuesta si vienen como JSON
      let answerOptions: { text: string; isCorrect?: boolean }[] = [];
      if (createQuestionDto.answerOptionsJson) {
        try {
          answerOptions = JSON.parse(createQuestionDto.answerOptionsJson);
        } catch (error) {
          throw new BadRequestException('Invalid answer options JSON format');
        }
      }

      // Crear DTO completo
      const completeDto: CreateQuestionDto = {
        text: createQuestionDto.text,
        type: createQuestionDto.type,
        order: createQuestionDto.order,
        weight: createQuestionDto.weight || 1,
        imageUrl: imageUrl, // 👈 URL de la imagen subida
        quizId: createQuestionDto.quizId,
        answerOptions: answerOptions,
      };

      return await this.create(completeDto);
    } catch (error) {
      console.error('Error creating question with image:', error);
      throw new BadRequestException('Failed to create question with image');
    }
  }
  async uploadImageToQuestion(
    questionId: string,
    imageFile: Express.Multer.File,
  ): Promise<Question> {
    // Verificar que la pregunta existe
    const existingQuestion = await this.findOne(questionId);

    try {
      // Si ya tiene imagen, eliminar la anterior
      if (existingQuestion.imageUrl) {
        await this.bunnyService.deleteFile(existingQuestion.imageUrl);
      }

      // Subir nueva imagen
      const imageUrl = await this.bunnyService.uploadFile(imageFile);

      // Actualizar pregunta con nueva URL
      return await this.prisma.question.update({
        where: { id: questionId },
        data: { imageUrl },
        include: {
          answerOptions: true,
          quiz: {
            select: { id: true, title: true },
          },
        },
      });
    } catch (error) {
      console.error('Error uploading image to question:', error);
      throw new BadRequestException('Failed to upload image to question');
    }
  }
  async removeImageFromQuestion(questionId: string): Promise<Question> {
    // Verificar que la pregunta existe
    const existingQuestion = await this.findOne(questionId);

    if (!existingQuestion.imageUrl) {
      throw new BadRequestException('Question does not have an image');
    }

    try {
      // Eliminar imagen de Bunny.net
      await this.bunnyService.deleteFile(existingQuestion.imageUrl);

      // Actualizar pregunta eliminando URL
      return await this.prisma.question.update({
        where: { id: questionId },
        data: { imageUrl: null },
        include: {
          answerOptions: true,
          quiz: {
            select: { id: true, title: true },
          },
        },
      });
    } catch (error) {
      console.error('Error removing image from question:', error);
      throw new BadRequestException('Failed to remove image from question');
    }
  }

  // Obtener todas las preguntas con filtros
  async findAll(query: QueryQuestionsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      quizId,
      type,
      sortBy = 'order',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = {
      ...(quizId && { quizId }),
      ...(type && { type }),
      ...(search && {
        OR: [{ text: { contains: search, mode: 'insensitive' } }],
      }),
    };

    const orderBy: Prisma.QuestionOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.QuestionOrderByWithRelationInput] =
      sortOrder;

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          quiz: {
            select: { id: true, title: true },
          },
          answerOptions: true,
          _count: {
            select: { answerOptions: true },
          },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data: questions.map((question) => ({
        ...question,
        hasImage: !!question.imageUrl, // 👈 NUEVO: Indicador si tiene imagen
        optionsCount: question._count.answerOptions,
        correctOptionsCount: question.answerOptions.filter(
          (opt) => opt.isCorrect,
        ).length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener preguntas de un quiz específico
  async findByQuiz(quizId: string, isAdmin: boolean = false) {
    // Verificar que el quiz existe
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const questions = await this.prisma.question.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
      include: {
        answerOptions: {
          orderBy: { text: 'asc' },
        },
      },
    });

    if (isAdmin) {
      return questions;
    }

    // Para estudiantes, ocultar respuestas correctas
    return questions.map((question) => ({
      id: question.id,
      text: question.text,
      type: question.type,
      order: question.order,
      weight: question.weight,
      imageUrl: question.imageUrl,
      answerOptions: question.answerOptions.map((option) => ({
        id: option.id,
        text: option.text,
        // isCorrect omitido para estudiantes
      })),
    }));
  }

  // Método especial para obtener preguntas para estudiantes (usado por QuizzesService)
  async findByQuizForStudent(quizId: string) {
    return this.findByQuiz(quizId, false);
  }

  // Método especial para obtener preguntas con respuestas correctas (usado por QuizzesService)
  async findByQuizWithAnswers(quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Retornar preguntas CON answerOptions completas (incluyendo isCorrect)
    return await this.prisma.question.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
      include: {
        answerOptions: true, // ← Incluir todas las opciones con isCorrect
      },
    });
  }

  // Obtener pregunta por ID
  async findOne(id: string): Promise<Question> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        quiz: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
        answerOptions: {
          orderBy: { text: 'asc' },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return question;
  }

  // Actualizar pregunta
  async update(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<Question> {
    // Verificar que la pregunta existe
    const existingQuestion = await this.findOne(id);

    // Si se actualiza el order, verificar que no exista conflicto
    if (
      updateQuestionDto.order &&
      updateQuestionDto.order !== existingQuestion.order
    ) {
      await this.checkQuestionOrderConflict(
        existingQuestion.quizId,
        updateQuestionDto.order,
        id,
      );
    }

    try {
      return await this.prisma.question.update({
        where: { id },
        data: updateQuestionDto,
        include: {
          answerOptions: true,
          quiz: {
            select: { id: true, title: true },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Question with this order already exists',
          );
        }
      }
      throw new BadRequestException('Failed to update question');
    }
  }

  // Duplicar pregunta a otro quiz - CORREGIDO
  async duplicateQuestion(id: string, targetQuizId: string): Promise<Question> {
    // Obtener la pregunta original CON sus opciones de respuesta
    const originalQuestion = await this.prisma.question.findUnique({
      where: { id },
      include: {
        answerOptions: true, // ← INCLUIR explícitamente las opciones
        quiz: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    if (!originalQuestion) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    // Verificar que el quiz destino existe
    const targetQuiz = await this.prisma.quiz.findUnique({
      where: { id: targetQuizId },
    });

    if (!targetQuiz) {
      throw new NotFoundException('Target quiz not found');
    }

    // Obtener el siguiente orden disponible en el quiz destino
    const nextOrder = await this.getNextOrderForQuiz(targetQuizId);

    // Duplicar pregunta con opciones
    return await this.prisma.question.create({
      data: {
        text: `${originalQuestion.text} (Copia)`,
        type: originalQuestion.type,
        order: nextOrder,
        weight: originalQuestion.weight,
        quizId: targetQuizId,
        answerOptions: {
          create: originalQuestion.answerOptions.map((option) => ({
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        },
      },
      include: {
        answerOptions: true,
        quiz: {
          select: { id: true, title: true },
        },
      },
    });
  }

  // Reordenar preguntas
  async reorderQuestions(
    quizId: string,
    reorderDto: ReorderQuestionsDto,
  ): Promise<Question[]> {
    // Verificar que el quiz existe
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Verificar que todas las preguntas pertenecen al quiz
    const questionIds = reorderDto.questions.map((q) => q.id);
    const existingQuestions = await this.prisma.question.findMany({
      where: {
        id: { in: questionIds },
        quizId,
      },
    });

    if (existingQuestions.length !== questionIds.length) {
      throw new BadRequestException(
        'Some questions do not belong to this quiz',
      );
    }

    // Verificar que no hay órdenes duplicados
    const orders = reorderDto.questions.map((q) => q.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Duplicate order values are not allowed');
    }

    // Realizar las actualizaciones en transacción
    const updatedQuestions = await this.prisma.$transaction(
      reorderDto.questions.map((questionOrder) =>
        this.prisma.question.update({
          where: { id: questionOrder.id },
          data: { order: questionOrder.order },
        }),
      ),
    );

    // Retornar preguntas ordenadas
    return this.prisma.question.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
      include: {
        answerOptions: true,
      },
    });
  }

  // Eliminar pregunta
  async remove(id: string): Promise<Question> {
    // Verificar que la pregunta existe
    await this.findOne(id);

    // Las answer_options se eliminan automáticamente por CASCADE
    return await this.prisma.question.delete({
      where: { id },
    });
  }

  // Duplicar todas las preguntas de un quiz a otro (usado por QuizzesService) - CORREGIDO
  async duplicateQuizQuestions(
    sourceQuizId: string,
    targetQuizId: string,
  ): Promise<void> {
    const sourceQuestions = await this.prisma.question.findMany({
      where: { quizId: sourceQuizId },
      include: { answerOptions: true }, // ← Incluir answerOptions explícitamente
      orderBy: { order: 'asc' },
    });

    for (const question of sourceQuestions) {
      await this.prisma.question.create({
        data: {
          text: question.text,
          type: question.type,
          order: question.order,
          weight: question.weight,
          quizId: targetQuizId,
          answerOptions: {
            create: question.answerOptions.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          },
        },
      });
    }
  }

  // ========== ANSWER OPTION METHODS ==========

  // Agregar opción de respuesta a una pregunta
  async addAnswerOption(
    createAnswerOptionDto: CreateAnswerOptionSimpleDto,
  ): Promise<AnswerOption> {
    // Verificar que la pregunta existe
    const question = await this.findOne(createAnswerOptionDto.questionId);

    try {
      return await this.prisma.answerOption.create({
        data: createAnswerOptionDto,
      });
    } catch (error) {
      throw new BadRequestException('Failed to add answer option');
    }
  }

  // Obtener opciones de una pregunta
  async getAnswerOptions(questionId: string): Promise<AnswerOption[]> {
    // Verificar que la pregunta existe
    await this.findOne(questionId);

    return this.prisma.answerOption.findMany({
      where: { questionId },
      orderBy: { text: 'asc' },
    });
  }

  // Actualizar opción de respuesta
  async updateAnswerOption(
    id: string,
    updateAnswerOptionDto: UpdateAnswerOptionDto,
  ): Promise<AnswerOption> {
    // Verificar que la opción existe
    const existingOption = await this.prisma.answerOption.findUnique({
      where: { id },
    });

    if (!existingOption) {
      throw new NotFoundException(`Answer option with ID ${id} not found`);
    }

    try {
      return await this.prisma.answerOption.update({
        where: { id },
        data: updateAnswerOptionDto,
      });
    } catch (error) {
      throw new BadRequestException('Failed to update answer option');
    }
  }

  // Eliminar opción de respuesta
  async removeAnswerOption(id: string): Promise<AnswerOption> {
    // Verificar que la opción existe
    const answerOption = await this.prisma.answerOption.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    if (!answerOption) {
      throw new NotFoundException(`Answer option with ID ${id} not found`);
    }

    // Verificar que no sea la única opción (mínimo 2 opciones por pregunta)
    if (answerOption.question.answerOptions.length <= 2) {
      throw new BadRequestException(
        'Cannot delete answer option. Questions must have at least 2 options.',
      );
    }

    return await this.prisma.answerOption.delete({
      where: { id },
    });
  }

  // ========== STATISTICS METHODS ==========

  // Obtener estadísticas de preguntas
  async getQuestionStats() {
    const [totalQuestions, totalAnswerOptions, questionsByType] =
      await Promise.all([
        this.prisma.question.count(),
        this.prisma.answerOption.count(),
        this.prisma.question.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
      ]);

    const avgOptionsPerQuestion =
      totalQuestions > 0
        ? Math.round((totalAnswerOptions / totalQuestions) * 100) / 100
        : 0;

    return {
      totalQuestions,
      totalAnswerOptions,
      averageOptionsPerQuestion: avgOptionsPerQuestion,
      questionsByType: questionsByType.map((item) => ({
        type: item.type,
        count: item._count.type,
      })),
    };
  }

  // ========== ACCESS CONTROL METHODS ==========

  // Verificar acceso a quiz (reutilizado del QuizzesService)
  async checkUserAccessToQuiz(
    quizId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return; // Admins tienen acceso completo
    }

    // Verificar enrollment del estudiante
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: userId,
        status: 'ACTIVE',
        course: {
          modules: {
            some: {
              quizzes: {
                some: { id: quizId },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this quiz');
    }
  }

  // ========== UTILITY METHODS ==========

  // Obtener siguiente orden disponible para un quiz
  async getNextOrderForQuiz(quizId: string): Promise<number> {
    const maxOrder = await this.prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (maxOrder?.order || 0) + 1;
  }

  // Verificar conflicto de orden en preguntas
  private async checkQuestionOrderConflict(
    quizId: string,
    order: number,
    excludeId?: string,
  ): Promise<void> {
    const conflictQuestion = await this.prisma.question.findFirst({
      where: {
        quizId,
        order,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });

    if (conflictQuestion) {
      throw new ConflictException(
        `Question with order ${order} already exists in this quiz`,
      );
    }
  }

  // Validar opciones de respuesta según tipo de pregunta
  private validateAnswerOptions(
    questionType: QuestionType,
    answerOptions: { text: string; isCorrect?: boolean }[],
  ): void {
    if (answerOptions.length < 2) {
      throw new BadRequestException(
        'Questions must have at least 2 answer options',
      );
    }

    const correctOptions = answerOptions.filter((option) => option.isCorrect);

    switch (questionType) {
      case QuestionType.SINGLE:
      case QuestionType.TRUEFALSE:
        if (correctOptions.length !== 1) {
          throw new BadRequestException(
            `${questionType} questions must have exactly 1 correct answer`,
          );
        }
        break;

      case QuestionType.MULTIPLE:
        if (correctOptions.length < 1) {
          throw new BadRequestException(
            'Multiple choice questions must have at least 1 correct answer',
          );
        }
        break;

      default:
        throw new BadRequestException(
          `Unsupported question type: ${questionType}`,
        );
    }

    // Para TRUE/FALSE, validar que solo hay 2 opciones
    if (questionType === QuestionType.TRUEFALSE && answerOptions.length !== 2) {
      throw new BadRequestException(
        'True/False questions must have exactly 2 options',
      );
    }
  }
}
