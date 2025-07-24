// progress/dto/bulk-progress.dto.ts
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkProgressLessonDto {
  @IsString()
  lessonId: string;
}

export class BulkProgressDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProgressLessonDto)
  lessons: BulkProgressLessonDto[];

  @IsString()
  enrollmentId: string;
}
