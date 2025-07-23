// quizzes/dto/quiz-response.dto.ts
export class QuizResponseDto {
  id: string;
  title: string;
  passingScore: number;
  attemptsAllowed: number;
  moduleId: string;
}

export class QuizWithDetailsDto extends QuizResponseDto {
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
  _count: {
    questions: number;
  };
  totalPoints?: number;
}

export class QuizListDto {
  id: string;
  title: string;
  passingScore: number;
  attemptsAllowed: number;
  questionsCount: number;
  totalPoints: number;
}
// Para estudiantes (sin información sensible)
export class QuizForStudentDto {
  id: string;
  title: string;
  passingScore: number;
  attemptsAllowed: number;
  questionsCount: number;
  totalPoints: number;
}