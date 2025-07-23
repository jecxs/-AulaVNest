// resources/resources.module.ts
import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService], // Para usar en otros módulos
})
export class ResourcesModule {}
