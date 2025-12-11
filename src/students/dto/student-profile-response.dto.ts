// students/dto/student-profile-response.dto.ts

export class StudentProfileResponseDto {
  // Información básica del usuario
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: Date;

  // Roles del usuario
  roles: Array<{
    id: string;
    name: string;
  }>;

  // Resumen de cursos
  coursesStats: {
    totalEnrolled: number;
    activeEnrollments: number;
    completedCourses: number;
    expiredEnrollments: number;
  };

  // Lista de cursos activos
  activeCourses: Array<{
    enrollmentId: string;
    courseId: string;
    courseTitle: string;
    courseSlug: string;
    courseThumbnailUrl: string | null;
    categoryName: string;
    instructorName: string;
    enrolledAt: Date;
    expiresAt: Date | null;
    progressPercentage: number;
    completedLessons: number;
    totalLessons: number;
    nextLessonTitle: string | null;
  }>;

  // Próximas sesiones en vivo
  upcomingSessions: Array<{
    id: string;
    topic: string;
    startsAt: Date;
    endsAt: Date;
    meetingUrl: string | null;
    courseTitle: string;
    courseId: string;
  }>;

  // Notificaciones sin leer
  unreadNotifications: number;
}
