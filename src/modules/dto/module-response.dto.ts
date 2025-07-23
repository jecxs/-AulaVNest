// modules/dto/module-response.dto.ts
export class ModuleResponseDto {
  id: string;
  title: string;
  description?: string;
  order: number;
  isRequired: boolean;
  courseId: string;
}

export class ModuleWithContentDto extends ModuleResponseDto {
  lessons: Array<{
    id: string;
    title: string;
    type: string;
    order: number;
    durationSec?: number;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    passingScore: number;
    attemptsAllowed: number;
  }>;
  _count: {
    lessons: number;
    quizzes: number;
  };
}

export class ModuleListDto {
  id: string;
  title: string;
  description?: string;
  order: number;
  isRequired: boolean;
  _count: {
    lessons: number;
    quizzes: number;
  };
}
