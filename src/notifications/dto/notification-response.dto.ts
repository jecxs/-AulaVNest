// notifications/dto/notification-response.dto.ts
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  payload?: any;
  readAt?: Date | null;
  sentAt: Date;
  userId: string;
}

export class NotificationSummaryDto {
  total: number;
  unread: number;
  notifications: NotificationResponseDto[];
}
