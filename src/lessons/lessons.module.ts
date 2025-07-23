// lessons/lessons.module.ts
import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService], // Para usar en otros módulos como progress
})
export class LessonsModule {}
