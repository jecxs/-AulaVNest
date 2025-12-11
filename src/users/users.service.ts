// src/users/users.service.ts - ACTUALIZACIÓN COMPLETA
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, UserStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, AdminResetPasswordDto } from './dto/change-password.dto';
import { PasswordGenerator } from '../common/utils/password-generator.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ========== CREAR USUARIO CON GENERACIÓN AUTOMÁTICA DE CONTRASEÑA ==========
  async create(createUserDto: CreateUserDto): Promise<{ user: User; generatedPassword?: string }> {
    // Validar que el email no exista
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Si no se proporciona contraseña, generar una automáticamente
    let passwordPlainText: string | undefined;
    let passwordToHash: string;

    if (!createUserDto.password) {
      passwordPlainText = PasswordGenerator.generate(12, true);
      passwordToHash = passwordPlainText;
    } else {
      passwordToHash = createUserDto.password;
    }

    // Hashear la contraseña
    const passwordHash = await this.hashPassword(passwordToHash);

    // Crear el usuario
    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          phone: createUserDto.phone,
          status: createUserDto.status || UserStatus.ACTIVE,
        },
      });

      // Retornar el usuario y la contraseña generada (si aplica)
      return {
        user,
        generatedPassword: passwordPlainText,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('User with this email already exists');
        }
      }
      throw error;
    }
  }

  // ========== CAMBIO DE CONTRASEÑA POR EL USUARIO ==========
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.findOne(userId);

    // Verificar que la contraseña actual sea correcta
    const isCurrentPasswordValid = await this.validatePassword(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Verificar que la nueva contraseña sea diferente a la actual
    const isSamePassword = await this.validatePassword(
      changePasswordDto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hashear la nueva contraseña
    const newPasswordHash = await this.hashPassword(changePasswordDto.newPassword);

    // Actualizar la contraseña
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  // ========== RESETEAR CONTRASEÑA (SOLO ADMIN) ==========
  async adminResetPassword(
    adminId: string,
    targetUserId: string,
    resetPasswordDto?: AdminResetPasswordDto,
  ): Promise<{ user: User; newPassword: string }> {
    // Verificar que el usuario objetivo existe
    const targetUser = await this.findOne(targetUserId);

    // Generar nueva contraseña o usar la proporcionada
    const newPassword = resetPasswordDto?.password || PasswordGenerator.generate(12, true);

    // Hashear la nueva contraseña
    const newPasswordHash = await this.hashPassword(newPassword);

    // Actualizar la contraseña
    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      user: updatedUser,
      newPassword,
    };
  }

  // ========== MÉTODOS EXISTENTES (SIN CAMBIOS) ==========

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const updateData: any = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.passwordHash = await this.hashPassword(updateUserDto.password);
      delete updateData.password;
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email already exists');
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
      },
    });
  }

  isUserActive(user: User): boolean {
    return user.status === UserStatus.ACTIVE;
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async suspendUser(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
      },
    });
  }

  async activateUser(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
      },
    });
  }

  async getUserStats() {
    const [total, active, suspended] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    ]);

    return {
      total,
      active,
      suspended,
    };
  }
}