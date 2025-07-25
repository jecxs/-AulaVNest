// live-sessions/dto/live-session-response.dto.ts
export class LiveSessionResponseDto {
  id: string;
  topic: string;
  startsAt: Date;
  endsAt: Date;
  meetingUrl?: string;
  courseId: string;
}

export class LiveSessionWithDetailsDto extends LiveSessionResponseDto {
  course: {
    id: string;
    title: string;
    status: string;
    instructor: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
    };
  };
  duration: number; // En minutos
  isUpcoming: boolean;
  isLive: boolean;
  isPast: boolean;
  timeUntilStart?: number; // Minutos hasta el inicio
  enrolledStudents: number;
}

export class LiveSessionListDto {
  id: string;
  topic: string;
  startsAt: Date;
  endsAt: Date;
  duration: number;
  courseTitle: string;
  instructorName: string;
  enrolledStudents: number;
  status: 'upcoming' | 'live' | 'past';
  hasLink: boolean;
}

// Para estudiantes (información limitada)
export class LiveSessionForStudentDto {
  id: string;
  topic: string;
  startsAt: Date;
  endsAt: Date;
  meetingUrl?: string; // Solo si está próxima o en vivo
  courseTitle: string;
  instructorName: string;
  status: 'upcoming' | 'live' | 'past';
  canJoin: boolean;
  timeUntilStart?: number;
}
