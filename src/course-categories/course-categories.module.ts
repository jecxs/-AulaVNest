// course-categories/course-categories.module.ts
import { Module } from '@nestjs/common';
import { CourseCategoriesService } from './course-categories.service';
import { CourseCategoriesController } from './course-categories.controller';

@Module({
  controllers: [CourseCategoriesController],
  providers: [CourseCategoriesService],
  exports: [CourseCategoriesService], // Para usar en otros módulos como courses
})
export class CourseCategoriesModule {}
