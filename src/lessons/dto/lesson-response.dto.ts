// lessons/dto/lesson-response.dto.ts
export class LessonResponseDto {
  id: string;
  title: string;
  type: string;
  order: number;
  durationSec?: number;
  videoUrl?: string;
  markdownContent?: string;
  moduleId: string;
}

export class LessonWithResourcesDto extends LessonResponseDto {
  resources: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileUrl: string;
    sizeKb?: number;
  }>;
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
}

export class LessonListDto {
  id: string;
  title: string;
  type: string;
  order: number;
  durationSec?: number;
  hasVideo: boolean;
  hasResources: boolean;
  resourcesCount: number;
}
