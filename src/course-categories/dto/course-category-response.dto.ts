// course-categories/dto/course-category-response.dto.ts
export class CourseCategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export class CourseCategoryWithCoursesDto extends CourseCategoryResponseDto {
  courses: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    level: string;
    thumbnailUrl?: string;
    enrollmentCount: number;
  }>;
  _count: {
    courses: number;
  };
}

export class CourseCategoryListDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  _count: {
    courses: number;
  };
}
