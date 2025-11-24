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
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private questionsService: QuestionsService,
    private notificationsService: NotificationsService, // Inyectamos el servicio de preguntas
    private enrollmentsService: EnrollmentsService,
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
      questions,
      totalPoints: await this.calculateTotalPoints(id),
    };
  }

  // Enviar respuestas de quiz - CORREGIDO
  async submitQuiz(
    submitQuizDto: SubmitQuizDto,
    userId: string,
  ): Promise<QuizResultDto> {
    // 1. Obtener todas las preguntas del quiz CON respuestas correctas
    const questions = await this.prisma.question.findMany({
      where: { quizId: submitQuizDto.quizId },
      orderBy: { order: 'asc' },
      include: {
        answerOptions: true,
      },
    });

    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions');
    }

    // 2. Validar que todas las preguntas están respondidas
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

    // 3. Obtener información del quiz y enrollment
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: submitQuizDto.quizId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Obtener enrollment del estudiante
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: quiz.module.courseId,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not have access to this quiz');
    }

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

      if (!userAnswer) {
        throw new BadRequestException(
          `Missing answer for question ${question.id}`,
        );
      }

      const correctOptionIds = question.answerOptions
        .filter((option) => option.isCorrect)
        .map((option) => option.id);

      maxScore += question.weight;

      let isCorrect = false;
      if (question.type === QuestionType.SINGLE) {
        isCorrect =
          userAnswer.selectedOptionIds.length === 1 &&
          correctOptionIds.includes(userAnswer.selectedOptionIds[0]);
      } else if (question.type === QuestionType.MULTIPLE) {
        isCorrect =
          userAnswer.selectedOptionIds.length === correctOptionIds.length &&
          userAnswer.selectedOptionIds.every((id) =>
            correctOptionIds.includes(id),
          );
      } else if (question.type === QuestionType.TRUEFALSE) {
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

    const quizAttempt = await this.prisma.quizAttempt.create({
      data: {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage,
        passed: passed,
        answers: answerResults, // Guardar respuestas como JSON
        submittedAt: new Date(),
      },
    });

    console.log(`✅ Quiz attempt saved: ${quizAttempt.id}`);

    // 6. Emitir notificaciones
    await this.emitQuizResultNotifications(userId, quiz, {
      quizId: quiz.id,
      score: totalScore,
      maxScore: maxScore,
      percentage: percentage,
      passed: passed,
      answers: answerResults,
      submittedAt: new Date(),
    });

    // 7. Retornar resultado
    return {
      quizId: quiz.id,
      score: totalScore,
      maxScore: maxScore,
      percentage: percentage,
      passed: passed,
      answers: answerResults,
      submittedAt: new Date(),
      attemptId: quizAttempt.id,
    };
  }
  async getUserQuizAttempts(userId: string, quizId: string) {
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

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: quiz.module.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    // Obtener todos los intentos del usuario para este quiz
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        enrollmentId: enrollment.id,
        quizId: quizId,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Calcular estadísticas
    const totalAttempts = attempts.length;
    const bestAttempt = attempts.reduce(
      (best, current) =>
        current.percentage > (best?.percentage || 0) ? current : best,
      attempts[0],
    );

    const passed = attempts.some((attempt) => attempt.passed);

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      passingScore: quiz.passingScore,
      totalAttempts,
      bestScore: bestAttempt?.score || 0,
      bestPercentage: bestAttempt?.percentage || 0,
      lastAttempt: attempts[0]?.submittedAt,
      passed,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
      })),
    };
  }
  async getQuizAttemptDetail(attemptId: string, userId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        enrollment: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        quiz: {
          include: {
            questions: {
              include: {
                answerOptions: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }

    // Verificar que el usuario sea el dueño del intento
    if (attempt.enrollment.userId !== userId) {
      throw new ForbiddenException('You can only view your own attempts');
    }

    return {
      id: attempt.id,
      quizTitle: attempt.quiz.title,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers, // Respuestas detalladas del intento
      questions: attempt.quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        weight: q.weight,
        answerOptions: q.answerOptions,
      })),
    };
  }

  private async emitQuizResultNotifications(
    userId: string,
    quiz: any,
    result: QuizResultDto,
  ) {
    try {
      const quizData = {
        title: quiz.title,
        score: result.score,
        percentage: result.percentage,
        courseName: quiz.module.course.title,
      };

      if (result.passed) {
        // ✅ Quiz aprobado
        await this.notificationsService.createQuizPassedNotification(
          userId,
          quizData,
        );

        console.log(
          `✅ Quiz passed notification sent for user ${userId} - ${quiz.title}`,
        );
      } else {
        // ❌ Quiz reprobado
        await this.notificationsService.createQuizFailedNotification(userId, {
          ...quizData,
          passingScore: quiz.passingScore,
        });

        console.log(
          `❌ Quiz failed notification sent for user ${userId} - ${quiz.title}`,
        );
      }
    } catch (error) {
      // No fallar el quiz por errores en notificaciones
      console.error('Error emitting quiz result notifications:', error);
    }
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

    // ✅ USAR SERVICIO INYECTADO
    const accessCheck = await this.enrollmentsService.checkUserAccessToCourse(
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

    // ✅ USAR PRISMA DIRECTAMENTE PARA EVITAR DEPENDENCIA CIRCULAR
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
