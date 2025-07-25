import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentReceiptsService } from './payment-receipts.service';
import { CreatePaymentReceiptDto } from './dto/create-payment-receipt.dto';
import { UpdatePaymentReceiptDto } from './dto/update-payment-receipt.dto';
import { QueryPaymentReceiptsDto } from './dto/query-payment-receipts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('payment-receipts')
export class PaymentReceiptsController {
  constructor(
    private readonly paymentReceiptsService: PaymentReceiptsService,
  ) {}

  // ========== CRUD BÁSICO ==========

  // POST /payment-receipts - Crear payment receipt (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPaymentReceiptDto: CreatePaymentReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentReceiptsService.create(createPaymentReceiptDto, user.id);
  }

  // GET /payment-receipts - Listar payment receipts (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryPaymentReceiptsDto) {
    return this.paymentReceiptsService.findAll(query);
  }

  // GET /payment-receipts/my-payments - Payments del usuario actual
  @Get('my-payments')
  @UseGuards(JwtAuthGuard)
  async getMyPayments(
    @CurrentUser() user: any,
    @Query() query: QueryPaymentReceiptsDto,
  ) {
    return this.paymentReceiptsService.findAll({ ...query, userId: user.id });
  }

  // GET /payment-receipts/pending - Pagos pendientes (Solo ADMIN)
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getPendingPayments() {
    return this.paymentReceiptsService.getPendingPayments();
  }

  // GET /payment-receipts/stats - Estadísticas básicas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.paymentReceiptsService.getBasicStats(dateFrom, dateTo);
  }

  // GET /payment-receipts/payment-methods - Métodos de pago disponibles
  @Get('payment-methods')
  async getPaymentMethods() {
    return this.paymentReceiptsService.getAvailablePaymentMethods();
  }

  // POST /payment-receipts/generate-reference - Generar referencia
  @Post('generate-reference')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async generateReference() {
    const referenceNumber =
      this.paymentReceiptsService.generateReferenceNumber();
    return { referenceNumber };
  }

  // GET /payment-receipts/enrollment/:enrollmentId - Payments de un enrollment
  @Get('enrollment/:enrollmentId')
  @UseGuards(JwtAuthGuard)
  async getEnrollmentPayments(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentReceiptsService.getEnrollmentPayments(enrollmentId);
  }

  // GET /payment-receipts/:id - Obtener payment receipt por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    await this.paymentReceiptsService.checkUserAccess(id, user.id, user.roles);
    return this.paymentReceiptsService.findOne(id);
  }

  // PATCH /payment-receipts/:id - Actualizar payment receipt (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updatePaymentReceiptDto: UpdatePaymentReceiptDto,
  ) {
    return this.paymentReceiptsService.update(id, updatePaymentReceiptDto);
  }

  // DELETE /payment-receipts/:id - Eliminar payment receipt (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.paymentReceiptsService.remove(id);
  }
}
