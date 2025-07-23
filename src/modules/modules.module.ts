// modules/modules.module.ts
import { Module } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';

@Module({
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService], // Para usar en otros módulos como lessons, quizzes
})
export class ModulesModule {}
