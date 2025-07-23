//roles.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, RoleName, User, Prisma } from '@prisma/client';
import { CreateRoleDto } from './dto/create-role.dto';
import {
  RoleWithUsers,
  UserRoleAssignment,
  RoleStatsResponse,
  RoleWithCount,
} from './types/roles.types';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // Crear un nuevo rol
  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    try {
      return await this.prisma.role.create({
        data: {
          name: createRoleDto.name,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Role ${createRoleDto.name} already exists`,
          );
        }
      }
      throw error;
    }
  }

  // Obtener todos los roles
  async findAll(): Promise<RoleWithCount[]> {
    return this.prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true, // Contar cuántos usuarios tienen este rol
          },
        },
      },
    });
  }

  // Obtener un rol por ID
  async findOne(id: string): Promise<RoleWithUsers> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  // Obtener rol por nombre
  async findByName(name: RoleName): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  // ========== OPERACIONES DE ASIGNACIÓN N:M ==========

  // Asignar rol a usuario
  async assignRoleToUser(
    userId: string,
    roleName: RoleName,
  ): Promise<UserRoleAssignment> {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verificar que el rol existe
    const role = await this.findByName(roleName);
    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    // Verificar si ya tiene el rol asignado
    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: userId,
          roleId: role.id,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(`User already has role ${roleName}`);
    }

    // Asignar el rol
    try {
      return await this.prisma.userRole.create({
        data: {
          userId: userId,
          roleId: role.id,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          role: true,
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to assign role to user');
    }
  }

  // Remover rol de usuario
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    // Verificar que la asignación existe
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: userId,
          roleId: roleId,
        },
      },
    });

    if (!userRole) {
      throw new NotFoundException('Role assignment not found');
    }

    // Remover la asignación
    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: userId,
          roleId: roleId,
        },
      },
    });
  }

  // Obtener todos los roles de un usuario
  async getUserRoles(userId: string): Promise<Role[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.roles.map((userRole) => userRole.role);
  }

  // Obtener todos los usuarios con un rol específico
  async getUsersByRole(roleName: RoleName): Promise<User[]> {
    const role = await this.findByName(roleName);
    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    const roleWithUsers = await this.prisma.role.findUnique({
      where: { id: role.id },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });

    return roleWithUsers?.users.map((userRole) => userRole.user) || [];
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  // Verificar si un usuario tiene un rol específico
  async userHasRole(userId: string, roleName: RoleName): Promise<boolean> {
    const role = await this.findByName(roleName);
    if (!role) return false;

    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: userId,
          roleId: role.id,
        },
      },
    });

    return !!userRole;
  }

  // Verificar si un usuario es administrador
  async isUserAdmin(userId: string): Promise<boolean> {
    return this.userHasRole(userId, RoleName.ADMIN);
  }

  // Verificar si un usuario es estudiante
  async isUserStudent(userId: string): Promise<boolean> {
    return this.userHasRole(userId, RoleName.STUDENT);
  }

  // Obtener nombres de roles de un usuario (útil para JWT)
  async getUserRoleNames(userId: string): Promise<RoleName[]> {
    const roles = await this.getUserRoles(userId);
    return roles.map((role) => role.name);
  }

  // Inicializar roles por defecto (útil para seeding)
  async initializeDefaultRoles(): Promise<void> {
    const roles = Object.values(RoleName);

    for (const roleName of roles) {
      const existingRole = await this.findByName(roleName);
      if (!existingRole) {
        await this.create({ name: roleName });
        console.log(`Created role: ${roleName}`);
      }
    }
  }

  // Estadísticas de roles
  async getRoleStats(): Promise<RoleStatsResponse> {
    const [totalRoles, adminCount, studentCount] = await Promise.all([
      this.prisma.role.count(),
      this.prisma.userRole.count({
        where: {
          role: { name: RoleName.ADMIN },
        },
      }),
      this.prisma.userRole.count({
        where: {
          role: { name: RoleName.STUDENT },
        },
      }),
    ]);

    return {
      totalRoles,
      assignments: {
        admin: adminCount,
        student: studentCount,
        total: adminCount + studentCount,
      },
    };
  }
}
