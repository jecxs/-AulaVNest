// shared/shared.module.ts (crear este archivo)
import { Module, Global } from '@nestjs/common';
import { BunnyService } from './services/bunny.service';

@Global()
@Module({
  providers: [BunnyService],
  exports: [BunnyService],
})
export class SharedModule {}
