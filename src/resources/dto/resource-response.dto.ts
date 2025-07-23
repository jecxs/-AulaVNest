// resources/dto/resource-response.dto.ts
export class ResourceResponseDto {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  sizeKb?: number | null; // Consistente con Prisma
  lessonId: string;
  createdAt?: Date;
}

export class ResourceWithLessonDto extends ResourceResponseDto {
  lesson: {
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

export class ResourceListDto {
  id: string;
  fileName: string;
  fileType: string;
  sizeKb?: number | null; // Consistente con Prisma
  downloadUrl: string;
  isImage: boolean;
  isPdf: boolean;
  isZip: boolean;
  createdAt: Date;
}
