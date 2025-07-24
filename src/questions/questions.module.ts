// questions/questions.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { QuizzesModule } from '../quizzes/quizzes.module'; // Para evitar dependencia circular

@Module({
  imports: [
    forwardRef(() => QuizzesModule), // forwardRef para evitar dependencia circular
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService], // Para usar en QuizzesModule
})
export class QuestionsModule {}
