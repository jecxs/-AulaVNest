// quizzes/dto/quiz-attempt.dto.ts - NUEVO ARCHIVO
export class QuizAttemptResponseDto {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: Date;
  quizId: string;
  enrollmentId: string;
  answers: any; // JSON con las respuestas detalladas
}

export class QuizAttemptListDto {
  id: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: Date;
}

export class UserQuizHistoryDto {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  bestScore: number;
  bestPercentage: number;
  lastAttempt?: Date;
  passed: boolean; // Si alguna vez aprobó
  attempts: QuizAttemptListDto[];
}