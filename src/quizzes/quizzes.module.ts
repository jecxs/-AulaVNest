// quizzes/quizzes.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuestionsModule } from '../questions/questions.module'; // Import del otro módulo
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [
    forwardRef(() => QuestionsModule), // forwardRef para evitar dependencia circular
    NotificationsModule,
    forwardRef(() => EnrollmentsModule),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService], // Para usar en otros módulos
})
export class QuizzesModule {}
