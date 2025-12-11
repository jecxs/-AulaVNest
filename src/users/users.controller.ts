// src/users/users.controller.ts - ACTUALIZACIÓN COMPLETA
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, AdminResetPasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ========== CREAR USUARIO (ADMIN) ==========
  @Post()
  @Roles(RoleName.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    const result = await this.usersService.create(createUserDto);

    // Si se generó una contraseña automáticamente, incluirla en la respuesta
    if (result.generatedPassword) {
      return {
        user: result.user,
        generatedPassword: result.generatedPassword,
        message: 'User created successfully with auto-generated password',
      };
    }

    return {
      user: result.user,
      message: 'User created successfully',
    };
  }

  // ========== CAMBIAR CONTRASEÑA (USUARIO AUTENTICADO) ==========
  @Patch('change-password')
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  // ========== RESETEAR CONTRASEÑA (ADMIN) ==========
  @Patch(':id/reset-password')
  @Roles(RoleName.ADMIN)
  async adminResetPassword(
    @Request() req,
    @Param('id') targetUserId: string,
    @Body() resetPasswordDto?: AdminResetPasswordDto,
  ) {
    const result = await this.usersService.adminResetPassword(
      req.user.id,
      targetUserId,
      resetPasswordDto,
    );

    return {
      user: result.user,
      newPassword: result.newPassword,
      message: 'Password reset successfully',
    };
  }

  // ========== RUTAS EXISTENTES (SIN CAMBIOS) ==========

  @Get()
  @Roles(RoleName.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(RoleName.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(RoleName.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/suspend')
  @Roles(RoleName.ADMIN)
  suspend(@Param('id') id: string) {
    return this.usersService.suspendUser(id);
  }

  @Patch(':id/activate')
  @Roles(RoleName.ADMIN)
  activate(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Get('stats')
  @Roles(RoleName.ADMIN)
  getStats() {
    return this.usersService.getUserStats();
  }
}