//roles.module.ts
import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService], // Exportamos para usarlo en Auth y otros módulos
})
export class RolesModule {}
