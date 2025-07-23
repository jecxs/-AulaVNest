// instructors/instructors.module.ts
import { Module } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { InstructorsController } from './instructors.controller';

@Module({
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService], // Para usar en otros módulos como courses
})
export class InstructorsModule {}
