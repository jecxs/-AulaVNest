// payment-receipts/dto/payment-receipt-response.dto.ts - CORREGIDO
export class PaymentReceiptResponseDto {
  id: string;
  amount: number;
  currency: string;
  method: string;
  referenceNumber?: string;
  paidAt: Date;
  enrollmentId: string;
  // Removido: notes, receivedBy (no existen en el schema)
}

export class PaymentReceiptWithDetailsDto extends PaymentReceiptResponseDto {
  enrollment: {
    id: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    course: {
      id: string;
      title: string;
      price?: number;
    };
  };
}

export class PaymentReceiptListDto {
  id: string;
  amount: number;
  currency: string;
  method: string;
  referenceNumber?: string;
  paidAt: Date;
  studentName: string;
  studentEmail: string;
  courseName: string;
}
