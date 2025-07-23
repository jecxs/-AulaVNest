// questions/dto/question-response.dto.ts
export class AnswerOptionResponseDto {
  id: string;
  text: string;
  isCorrect: boolean;
}

export class AnswerOptionForStudentDto {
  id: string;
  text: string;
  // isCorrect omitido para estudiantes
}

export class QuestionResponseDto {
  id: string;
  text: string;
  type: string;
  order: number;
  weight: number;
  quizId: string;
  answerOptions: AnswerOptionResponseDto[];
}

export class QuestionForStudentDto {
  id: string;
  text: string;
  type: string;
  order: number;
  weight: number;
  answerOptions: AnswerOptionForStudentDto[];
}

export class QuestionWithQuizDto extends QuestionResponseDto {
  quiz: {
    id: string;
    title: string;
    module: {
      id: string;
      title: string;
      course: {
        id: string;
        title: string;
      };
    };
  };
}

export class QuestionListDto {
  id: string;
  text: string;
  type: string;
  order: number;
  weight: number;
  optionsCount: number;
  correctOptionsCount: number;
}