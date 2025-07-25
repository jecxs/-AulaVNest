// live-sessions/live-sessions.module.ts
import { Module } from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';

@Module({
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
  exports: [LiveSessionsService], // Para usar en otros módulos como notifications
})
export class LiveSessionsModule {}
