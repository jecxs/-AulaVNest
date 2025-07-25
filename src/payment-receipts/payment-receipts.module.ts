// payment-receipts/payment-receipts.module.ts
import { Module } from '@nestjs/common';
import { PaymentReceiptsService } from './payment-receipts.service';
import { PaymentReceiptsController } from './payment-receipts.controller';

@Module({
  controllers: [PaymentReceiptsController],
  providers: [PaymentReceiptsService],
  exports: [PaymentReceiptsService], // Para usar en otros módulos como enrollments
})
export class PaymentReceiptsModule {}
