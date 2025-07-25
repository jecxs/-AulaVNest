// payment-receipts/payment-receipts.service.ts - CORREGIDO
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentReceipt, Prisma, RoleName } from '@prisma/client';
import {
  CreatePaymentReceiptDto,
  PaymentMethod,
} from './dto/create-payment-receipt.dto';
import { UpdatePaymentReceiptDto } from './dto/update-payment-receipt.dto';
import { QueryPaymentReceiptsDto } from './dto/query-payment-receipts.dto';

@Injectable()
export class PaymentReceiptsService {
  constructor(private prisma: PrismaService) {}

  // ========== CRUD BÁSICO ==========

  // Crear payment receipt
  async create(
    createPaymentReceiptDto: CreatePaymentReceiptDto,
    adminUserId: string,
  ): Promise<PaymentReceipt> {
    // Verificar que el enrollment existe
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: createPaymentReceiptDto.enrollmentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verificar referencia duplicada si se proporciona
    if (createPaymentReceiptDto.referenceNumber) {
      const existingReceipt = await this.prisma.paymentReceipt.findFirst({
        where: {
          referenceNumber: createPaymentReceiptDto.referenceNumber,
        },
      });

      if (existingReceipt) {
        throw new ConflictException('Reference number already exists');
      }
    }

    try {
      const paymentReceipt = await this.prisma.paymentReceipt.create({
        data: {
          amount: createPaymentReceiptDto.amount,
          currency: 'PEN', // Solo soles peruanos
          method: createPaymentReceiptDto.method,
          referenceNumber: createPaymentReceiptDto.referenceNumber,
          paidAt: createPaymentReceiptDto.paidAt
            ? new Date(createPaymentReceiptDto.paidAt)
            : new Date(),
          enrollmentId: createPaymentReceiptDto.enrollmentId,
          // Removido: notes y receivedBy (no existen en el schema actual)
        },
        include: {
          enrollment: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              course: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      // Auto-confirmar pago del enrollment
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { paymentConfirmed: true },
      });

      return paymentReceipt;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Reference number already exists');
        }
      }
      throw new BadRequestException('Failed to create payment receipt');
    }
  }

  // Listar payment receipts con filtros
  async findAll(query: QueryPaymentReceiptsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      enrollmentId,
      userId,
      courseId,
      method,
      dateFrom,
      dateTo,
      sortBy = 'paidAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentReceiptWhereInput = {
      ...(enrollmentId && { enrollmentId }),
      ...(userId && { enrollment: { userId } }),
      ...(courseId && { enrollment: { courseId } }),
      ...(method && { method }),
      ...(dateFrom && { paidAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { paidAt: { lte: new Date(dateTo) } }),
      ...(search && {
        OR: [
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          // Removido: notes (no existe en el schema)
          {
            enrollment: {
              user: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            enrollment: {
              course: { title: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };

    const orderBy: Prisma.PaymentReceiptOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.PaymentReceiptOrderByWithRelationInput] =
      sortOrder;

    const [paymentReceipts, total] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          enrollment: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              course: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.paymentReceipt.count({ where }),
    ]);

    // Enriquecer datos para listado
    const enrichedData = paymentReceipts.map((receipt) => ({
      ...receipt,
      studentName: `${receipt.enrollment.user.firstName} ${receipt.enrollment.user.lastName}`,
      studentEmail: receipt.enrollment.user.email,
      courseName: receipt.enrollment.course.title,
    }));

    return {
      data: enrichedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener payment receipt por ID
  async findOne(id: string): Promise<PaymentReceipt> {
    const paymentReceipt = await this.prisma.paymentReceipt.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            course: {
              select: {
                id: true,
                title: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!paymentReceipt) {
      throw new NotFoundException(`Payment receipt with ID ${id} not found`);
    }

    return paymentReceipt;
  }

  // Actualizar payment receipt
  async update(
    id: string,
    updatePaymentReceiptDto: UpdatePaymentReceiptDto,
  ): Promise<PaymentReceipt> {
    await this.findOne(id);

    // Verificar referencia duplicada si se actualiza
    if (updatePaymentReceiptDto.referenceNumber) {
      const existingReceipt = await this.prisma.paymentReceipt.findFirst({
        where: {
          referenceNumber: updatePaymentReceiptDto.referenceNumber,
          NOT: { id },
        },
      });

      if (existingReceipt) {
        throw new ConflictException('Reference number already exists');
      }
    }

    // Preparar datos de actualización (sin campos que no existen)
    const updateData: any = {};

    if (updatePaymentReceiptDto.amount)
      updateData.amount = updatePaymentReceiptDto.amount;
    if (updatePaymentReceiptDto.method)
      updateData.method = updatePaymentReceiptDto.method;
    if (updatePaymentReceiptDto.referenceNumber)
      updateData.referenceNumber = updatePaymentReceiptDto.referenceNumber;
    if (updatePaymentReceiptDto.paidAt)
      updateData.paidAt = new Date(updatePaymentReceiptDto.paidAt);
    // Removido: notes (no existe en el schema)

    return await this.prisma.paymentReceipt.update({
      where: { id },
      data: updateData,
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: {
                id: true,
                title: true,
                price: true,
              },
            },
          },
        },
      },
    });
  }

  // Eliminar payment receipt
  async remove(id: string): Promise<PaymentReceipt> {
    const paymentReceipt = await this.findOne(id);

    // Si es el único pago, desconfirmar el enrollment
    const enrollmentPayments = await this.prisma.paymentReceipt.count({
      where: { enrollmentId: paymentReceipt.enrollmentId },
    });

    if (enrollmentPayments === 1) {
      await this.prisma.enrollment.update({
        where: { id: paymentReceipt.enrollmentId },
        data: { paymentConfirmed: false },
      });
    }

    return await this.prisma.paymentReceipt.delete({
      where: { id },
    });
  }

  // ========== MÉTODOS ÚTILES ==========

  // Obtener payments de un enrollment específico
  async getEnrollmentPayments(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    return this.prisma.paymentReceipt.findMany({
      where: { enrollmentId },
      orderBy: { paidAt: 'desc' },
    });
  }

  // Obtener payments pendientes (enrollments sin pago confirmado)
  async getPendingPayments() {
    return this.prisma.enrollment.findMany({
      where: {
        paymentConfirmed: false,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  // Estadísticas básicas (solo las necesarias)
  async getBasicStats(dateFrom?: string, dateTo?: string) {
    const whereClause: Prisma.PaymentReceiptWhereInput = {};

    if (dateFrom || dateTo) {
      whereClause.paidAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [totalReceipts, totalAmount, byMethod] = await Promise.all([
      this.prisma.paymentReceipt.count({ where: whereClause }),

      this.prisma.paymentReceipt.aggregate({
        where: whereClause,
        _sum: { amount: true },
      }),

      this.prisma.paymentReceipt.groupBy({
        by: ['method'],
        where: whereClause,
        _count: { method: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalReceipts,
      totalAmount: totalAmount._sum.amount || 0,
      byMethod: byMethod.map((item) => ({
        method: item.method,
        count: item._count.method,
        totalAmount: item._sum.amount || 0,
      })),
    };
  }

  // Verificar acceso de usuario
  async checkUserAccess(
    paymentReceiptId: string,
    userId: string,
    userRoles: string[],
  ) {
    if (userRoles.includes(RoleName.ADMIN)) {
      return true;
    }

    const paymentReceipt = await this.prisma.paymentReceipt.findUnique({
      where: { id: paymentReceiptId },
      include: {
        enrollment: { select: { userId: true } },
      },
    });

    if (!paymentReceipt) {
      throw new NotFoundException('Payment receipt not found');
    }

    if (paymentReceipt.enrollment.userId !== userId) {
      throw new ForbiddenException(
        'You can only access your own payment receipts',
      );
    }

    return true;
  }

  // Métodos de pago disponibles (solo para Perú)
  getAvailablePaymentMethods() {
    return [
      { value: PaymentMethod.CASH, label: 'Efectivo' },
      { value: PaymentMethod.BANK_TRANSFER, label: 'Transferencia Bancaria' },
      { value: PaymentMethod.YAPE, label: 'Yape' },
      { value: PaymentMethod.PLIN, label: 'Plin' },
      { value: PaymentMethod.CARD, label: 'Tarjeta' },
      { value: PaymentMethod.OTHER, label: 'Otro' },
    ];
  }

  // Generar número de referencia
  generateReferenceNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PAY-${timestamp}-${random}`;
  }
}
