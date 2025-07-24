// progress/dto/progress-response.dto.ts
export class ProgressResponseDto {
  id: string;
  completedAt?: Date;
  score?: number;
  enrollmentId: string;
  lessonId: string;
}

export class ProgressWithDetailsDto extends ProgressResponseDto {
  enrollment: {
    id: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    course: {
      id: string;
      title: string;
    };
  };
  lesson: {
    id: string;
    title: string;
    type: string;
    order: number;
    durationSec?: number;
    module: {
      id: string;
      title: string;
      order: number;
    };
  };
}

export class CourseProgressSummaryDto {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  averageScore?: number;
  timeSpent?: number; // En segundos
  lastActivity?: Date;
  modules: Array<{
    moduleId: string;
    moduleTitle: string;
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
  }>;
}

export class UserProgressSummaryDto {
  userId: string;
  userName: string;
  totalEnrollments: number;
  totalCoursesCompleted: number;
  totalLessonsCompleted: number;
  averageScore?: number;
  totalTimeSpent?: number;
  courses: Array<{
    courseId: string;
    courseTitle: string;
    completionPercentage: number;
    lastActivity?: Date;
  }>;
}

export class LessonProgressStatsDto {
  lessonId: string;
  lessonTitle: string;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  averageScore?: number;
  studentsWithProgress: Array<{
    userId: string;
    userName: string;
    completedAt?: Date;
    score?: number;
  }>;
}
