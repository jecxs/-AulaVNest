// quizzes/quizzes.service.ts - CORREGIDO
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service'; // Import del otro módulo
import { Quiz, QuestionType, Prisma, RoleName } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quiz.dto';
import { SubmitQuizDto, QuizResultDto } from './dto/submit-quiz.dto';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private questionsService: QuestionsService, // Inyectamos el servicio de preguntas
  ) {}

  // Crear quiz
  async create(createQuizDto: CreateQuizDto): Promise<Quiz> {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: createQuizDto.moduleId },
      include: { course: true },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    try {
      return await this.prisma.quiz.create({
        data: createQuizDto,
        include: {
          module: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
          _count: {
            select: { questions: true },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to create quiz');
    }
  }

  // Obtener todos los quizzes con filtros
  async findAll(query: QueryQuizzesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      moduleId,
      courseId,
      sortBy = 'title',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.QuizWhereInput = {
      ...(moduleId && { moduleId }),
      ...(courseId && { module: { courseId } }),
      ...(search && {
        OR: [{ title: { contains: search, mode: 'insensitive' } }],
      }),
    };

    const orderBy: Prisma.QuizOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.QuizOrderByWithRelationInput] = sortOrder;

    const [quizzes, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          module: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
          _count: {
            select: { questions: true },
          },
        },
      }),
      this.prisma.quiz.count({ where }),
    ]);

    // Calcular puntos totales para cada quiz
    const quizzesWithPoints = await Promise.all(
      quizzes.map(async (quiz) => {
        const totalPoints = await this.calculateTotalPoints(quiz.id);
        return {
          ...quiz,
          questionsCount: quiz._count.questions,
          totalPoints,
        };
      }),
    );

    return {
      data: quizzesWithPoints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener quizzes de un módulo específico
  async findByModule(moduleId: string, isAdmin: boolean = false) {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const quizzes = await this.prisma.quiz.findMany({
      where: { moduleId },
      include: {
        _count: {
          select: { questions: true }, // ← INCLUIR explícitamente el conteo
        },
      },
      orderBy: { title: 'asc' },
    });

    // Calcular puntos totales para cada quiz
    const quizzesWithDetails = await Promise.all(
      quizzes.map(async (quiz) => {
        const totalPoints = await this.calculateTotalPoints(quiz.id);
        return {
          id: quiz.id,
          title: quiz.title,
          passingScore: quiz.passingScore,
          attemptsAllowed: quiz.attemptsAllowed,
          questionsCount: quiz._count.questions, // ← Ahora _count está disponible
          totalPoints: isAdmin ? totalPoints : totalPoints, // Por ahora mostramos a ambos
        };
      }),
    );

    return quizzesWithDetails;
  }

  // Obtener quiz por ID (versión completa para admin)
  async findOne(id: string): Promise<Quiz> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    return quiz;
  }

  // Obtener quiz para estudiante (información básica)
  async findOneForStudent(id: string) {
    // En lugar de usar this.findOne(), hacer la consulta directamente con _count
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        _count: {
          select: { questions: true }, // ← INCLUIR explícitamente el conteo
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    const totalPoints = await this.calculateTotalPoints(id);

    return {
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      attemptsAllowed: quiz.attemptsAllowed,
      questionsCount: quiz._count.questions, // ← Ahora _count está disponible
      totalPoints,
    };
  }

  // Obtener vista previa del quiz (con preguntas pero sin respuestas correctas)
  async getQuizPreview(id: string) {
    const quiz = await this.findOne(id);

    // Usamos el servicio de questions para obtener las preguntas sin respuestas correctas
    const questions = await this.questionsService.findByQuizForStudent(id);

    return {
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      attemptsAllowed: quiz.attemptsAllowed,
      questions,
      totalPoints: await this.calculateTotalPoints(id),
    };
  }

  // Enviar respuestas de quiz - CORREGIDO
  async submitQuiz(
    submitQuizDto: SubmitQuizDto,
    userId: string,
  ): Promise<QuizResultDto> {
    // Obtener todas las preguntas del quiz CON respuestas correctas
    const questions = await this.prisma.question.findMany({
      where: { quizId: submitQuizDto.quizId },
      orderBy: { order: 'asc' },
      include: {
        answerOptions: true, // ← INCLUIR explícitamente todas las opciones con isCorrect
      },
    });

    // Validar que el quiz tiene preguntas
    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions');
    }

    // Validar que todas las preguntas están respondidas
    const questionIds = questions.map((q) => q.id);
    const answeredQuestionIds = submitQuizDto.answers.map((a) => a.questionId);

    const missingQuestions = questionIds.filter(
      (id) => !answeredQuestionIds.includes(id),
    );
    if (missingQuestions.length > 0) {
      throw new BadRequestException(
        `Missing answers for questions: ${missingQuestions.join(', ')}`,
      );
    }

    // Obtener información del quiz
    const quiz = await this.findOne(submitQuizDto.quizId);

    // Calcular resultados
    let totalScore = 0;
    let maxScore = 0;
    const answerResults: Array<{
      questionId: string;
      selectedOptions: string[];
      correctOptions: string[];
      isCorrect: boolean;
      points: number;
    }> = [];

    for (const question of questions) {
      const userAnswer = submitQuizDto.answers.find(
        (a) => a.questionId === question.id,
      );

      // Verificación explícita de userAnswer para evitar undefined
      if (!userAnswer) {
        throw new BadRequestException(
          `Missing answer for question ${question.id}`,
        );
      }

      // Obtener opciones correctas - ahora isCorrect está disponible
      const correctOptionIds = question.answerOptions
        .filter((option) => option.isCorrect) // ← isCorrect está disponible
        .map((option) => option.id);

      maxScore += question.weight;

      // Verificar si la respuesta es correcta
      let isCorrect = false;
      if (question.type === QuestionType.SINGLE) {
        // Para preguntas de opción única
        isCorrect =
          userAnswer.selectedOptionIds.length === 1 &&
          correctOptionIds.includes(userAnswer.selectedOptionIds[0]);
      } else if (question.type === QuestionType.MULTIPLE) {
        // Para preguntas de opción múltiple
        isCorrect =
          userAnswer.selectedOptionIds.length === correctOptionIds.length &&
          userAnswer.selectedOptionIds.every((id) =>
            correctOptionIds.includes(id),
          );
      } else if (question.type === QuestionType.TRUEFALSE) {
        // Para preguntas verdadero/falso
        isCorrect =
          userAnswer.selectedOptionIds.length === 1 &&
          correctOptionIds.includes(userAnswer.selectedOptionIds[0]);
      }

      const pointsEarned = isCorrect ? question.weight : 0;
      totalScore += pointsEarned;

      answerResults.push({
        questionId: question.id,
        selectedOptions: userAnswer.selectedOptionIds,
        correctOptions: correctOptionIds,
        isCorrect: isCorrect,
        points: pointsEarned,
      });
    }

    const percentage = Math.round((totalScore / maxScore) * 100);
    const passed = percentage >= quiz.passingScore;

    return {
      quizId: quiz.id,
      score: totalScore,
      maxScore: maxScore,
      percentage: percentage,
      passed: passed,
      answers: answerResults,
      submittedAt: new Date(),
    };
  }

  // Obtener resultados de un quiz (placeholder para futura implementación con tabla de resultados)
  async getQuizResults(quizId: string, userId: string) {
    // Por ahora retornamos información básica
    // En el futuro se implementará una tabla QuizAttempt para guardar resultados
    const quiz = await this.findOne(quizId);

    return {
      message:
        'Quiz results will be implemented when QuizAttempt table is added',
      quizId,
      userId,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        passingScore: quiz.passingScore,
      },
    };
  }

  // Actualizar quiz
  async update(id: string, updateQuizDto: UpdateQuizDto): Promise<Quiz> {
    // Verificar que el quiz existe
    await this.findOne(id);

    try {
      return await this.prisma.quiz.update({
        where: { id },
        data: updateQuizDto,
        include: {
          module: {
            select: { id: true, title: true },
          },
          _count: {
            select: { questions: true },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to update quiz');
    }
  }

  // Duplicar quiz a otro módulo
  async duplicateQuiz(id: string, targetModuleId: string): Promise<Quiz> {
    const originalQuiz = await this.findOne(id);

    // Verificar que el módulo destino existe
    const targetModule = await this.prisma.module.findUnique({
      where: { id: targetModuleId },
    });

    if (!targetModule) {
      throw new NotFoundException('Target module not found');
    }

    // Crear el quiz duplicado
    const duplicatedQuiz = await this.prisma.quiz.create({
      data: {
        title: `${originalQuiz.title} (Copia)`,
        passingScore: originalQuiz.passingScore,
        attemptsAllowed: originalQuiz.attemptsAllowed,
        moduleId: targetModuleId,
      },
      include: {
        module: {
          select: { id: true, title: true },
        },
      },
    });

    // Duplicar preguntas usando el servicio de questions
    await this.questionsService.duplicateQuizQuestions(id, duplicatedQuiz.id);

    return duplicatedQuiz;
  }

  // Eliminar quiz
  async remove(id: string): Promise<Quiz> {
    // Verificar que el quiz existe
    await this.findOne(id);

    // Las questions y answer_options se eliminan automáticamente por CASCADE
    return await this.prisma.quiz.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de quizzes
  async getQuizStats() {
    const [totalQuizzes, avgPassingScore, quizzesByModule] = await Promise.all([
      this.prisma.quiz.count(),
      this.prisma.quiz.aggregate({
        _avg: { passingScore: true },
      }),
      this.prisma.quiz.groupBy({
        by: ['moduleId'],
        _count: { moduleId: true },
        orderBy: { _count: { moduleId: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      totalQuizzes,
      averagePassingScore: Math.round(avgPassingScore._avg.passingScore || 0),
      topModulesWithQuizzes: quizzesByModule.map((item) => ({
        moduleId: item.moduleId,
        quizCount: item._count.moduleId,
      })),
    };
  }

  // ========== ACCESS CONTROL METHODS ==========

  // Verificar acceso a quiz
  async checkUserAccessToQuiz(
    quizId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return; // Admins tienen acceso completo
    }

    // Obtener información del quiz y curso
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // 👈 NUEVO: Usar servicio de enrollments
    const enrollmentsService = new EnrollmentsService(this.prisma);
    const accessCheck = await enrollmentsService.checkUserAccessToCourse(
      quiz.module.courseId,
      userId,
    );

    if (!accessCheck.hasAccess) {
      throw new ForbiddenException(accessCheck.reason);
    }
  }

  // Verificar acceso a módulo
  async checkUserAccessToModule(
    moduleId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: userId,
        status: 'ACTIVE',
        course: {
          modules: {
            some: { id: moduleId },
          },
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this module');
    }
  }

  // ========== UTILITY METHODS ==========

  // Calcular puntos totales de un quiz
  private async calculateTotalPoints(quizId: string): Promise<number> {
    const questions = await this.prisma.question.findMany({
      where: { quizId },
      select: { weight: true },
    });

    return questions.reduce((sum, question) => sum + question.weight, 0);
  }
}
