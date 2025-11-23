import { Module } from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsSchedulerService } from './live-sessions-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LiveSessionsController],
  providers: [
    LiveSessionsService,
    LiveSessionsSchedulerService, // ← El servicio de recordatorios
  ],
  exports: [LiveSessionsService],
})
export class LiveSessionsModule {}
