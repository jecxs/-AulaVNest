// progress/progress.module.ts
import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [NotificationsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService], // Para usar en otros módulos como enrollments, certificates
})
export class ProgressModule {}
