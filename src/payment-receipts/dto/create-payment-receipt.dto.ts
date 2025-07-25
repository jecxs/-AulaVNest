// payment-receipts/dto/create-payment-receipt.dto.ts - CORREGIDO
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

// Solo métodos de pago relevantes para Perú
export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  YAPE = 'YAPE',
  PLIN = 'PLIN',
  CARD = 'CARD', // Tarjeta (crédito o débito)
  OTHER = 'OTHER',
}

export class CreatePaymentReceiptDto {
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceNumber?: string; // Número de transacción, operación

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsString()
  enrollmentId: string;
}
