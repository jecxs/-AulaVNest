// enrollments/enrollments.module.ts
import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService], // Para usar en otros módulos como progress, certificates
})
export class EnrollmentsModule {}
