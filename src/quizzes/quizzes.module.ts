// quizzes/quizzes.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuestionsModule } from '../questions/questions.module'; // Import del otro módulo

@Module({
  imports: [
    forwardRef(() => QuestionsModule), // forwardRef para evitar dependencia circular
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService], // Para usar en otros módulos
})
export class QuizzesModule {}