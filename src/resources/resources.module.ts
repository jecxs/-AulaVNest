// resources/resources.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { SharedModule } from '../shared/shared.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [
    SharedModule, // Para BunnyService
    forwardRef(() => EnrollmentsModule), // ← AGREGAR con forwardRef
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService], // Para usar en otros módulos
})
export class ResourcesModule {}
