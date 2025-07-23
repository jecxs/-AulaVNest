import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { InstructorsModule } from './instructors/instructors.module';
import { CourseCategoriesModule } from './course-categories/course-categories.module';
import { ModulesModule } from './modules/modules.module';
import { LessonsModule } from './lessons/lessons.module';
import { SharedModule } from './shared/shared.module';
import { ResourcesModule } from './resources/resources.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Para usar variables de entorno en toda la app
    }),
    PrismaModule,
    SharedModule,
    UsersModule,
    RolesModule,
    AuthModule,
    CoursesModule,
    InstructorsModule,
    CourseCategoriesModule,
    ModulesModule,
    LessonsModule,
    ResourcesModule,
  ],
})
export class AppModule {}
