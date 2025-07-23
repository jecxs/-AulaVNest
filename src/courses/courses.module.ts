// courses/courses.module.ts
import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService], // Para usar en otros módulos
})
export class CoursesModule {}
