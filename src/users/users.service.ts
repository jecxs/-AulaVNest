import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, UserStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Crear usuario
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Validar que el email no exista
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hashear la contraseña
    const passwordHash = await this.hashPassword(createUserDto.password);

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

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('User with this email already exists');
        }
      }
      throw error;
    }
  }

  // Obtener todos los usuarios
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Obtener usuario por ID
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

  // Obtener usuario por email
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

  // Actualizar usuario
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Verificar que el usuario existe
    await this.findOne(id);

    // Si se actualiza la contraseña, hashearla
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

  // Eliminar usuario (soft delete - cambiar status)
  async remove(id: string): Promise<User> {
    // Verificar que el usuario existe
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
      },
    });
  }

  // Métodos de utilidad (lógica de negocio)

  // Verificar si un usuario está activo
  isUserActive(user: User): boolean {
    return user.status === UserStatus.ACTIVE;
  }

  // Verificar contraseña
  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Hashear contraseña
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Suspender usuario
  async suspendUser(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
      },
    });
  }

  // Activar usuario
  async activateUser(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
      },
    });
  }

  // Obtener estadísticas de usuarios
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
