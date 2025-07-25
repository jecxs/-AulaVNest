import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentReceiptDto } from './create-payment-receipt.dto';

export class UpdatePaymentReceiptDto extends PartialType(
  CreatePaymentReceiptDto,
) {}
