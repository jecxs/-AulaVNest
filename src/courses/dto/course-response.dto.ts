// courses/dto/course-response.dto.ts
export class CourseResponseDto {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  level: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
  price?: number;
  status: string;
  visibility: string;
  createdAt: Date;
  publishedAt?: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  instructor: {
    id: string;
    firstName: string;
    lastName: string;
    bio?: string;
  };
  _count?: {
    modules: number;
    enrollments: number;
  };
}

export class CourseListResponseDto {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  level: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
  price?: number;
  status: string;
  visibility: string;
  publishedAt?: Date;
  category: {
    name: string;
    slug: string;
  };
  instructor: {
    firstName: string;
    lastName: string;
  };
  _count: {
    enrollments: number;
  };
}
