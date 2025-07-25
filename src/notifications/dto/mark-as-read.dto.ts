// notifications/dto/mark-as-read.dto.ts
import { IsArray, IsString } from 'class-validator';

export class MarkAsReadDto {
  @IsArray()
  @IsString({ each: true })
  notificationIds: string[];
}
