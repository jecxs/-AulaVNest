// progress/progress.module.ts
import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService], // Para usar en otros módulos como enrollments, certificates
})
export class ProgressModule {}
