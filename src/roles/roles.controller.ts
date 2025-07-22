import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RoleName } from '@prisma/client';
import {
  RoleResponseDto,
  UserWithRolesDto,
  RoleWithUsersDto,
  UserRoleAssignmentDto,
} from './dto/user-role-response.dto';
import {
  RoleWithUsers,
  UserRoleAssignment,
  UserBasicInfo,
  RoleStatsResponse,
} from './types/roles.types';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // POST /roles - Crear nuevo rol
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRoleDto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(createRoleDto);
  }

  // GET /roles - Obtener todos los roles
  @Get()
  async findAll(): Promise<RoleResponseDto[]> {
    return this.rolesService.findAll();
  }

  // GET /roles/stats - Estadísticas de roles
  @Get('stats')
  async getStats(): Promise<RoleStatsResponse> {
    return this.rolesService.getRoleStats();
  }

  // POST /roles/initialize - Inicializar roles por defecto
  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializeRoles(): Promise<{ message: string }> {
    await this.rolesService.initializeDefaultRoles();
    return { message: 'Default roles initialized successfully' };
  }

  // GET /roles/:id - Obtener rol por ID con usuarios
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RoleWithUsersDto> {
    const role: RoleWithUsers = await this.rolesService.findOne(id);

    return {
      id: role.id,
      name: role.name.toString(),
      users: role.users.map((userRole) => ({
        id: userRole.user.id,
        email: userRole.user.email,
        firstName: userRole.user.firstName,
        lastName: userRole.user.lastName,
        status: userRole.user.status.toString(),
      })),
    };
  }

  // ========== ENDPOINTS PARA ASIGNACIÓN DE ROLES ==========

  // POST /roles/assign - Asignar rol a usuario
  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Body() assignRoleDto: AssignRoleDto,
  ): Promise<UserRoleAssignmentDto> {
    const assignment: UserRoleAssignment =
      await this.rolesService.assignRoleToUser(
        assignRoleDto.userId,
        assignRoleDto.roleName,
      );

    return {
      userId: assignment.userId,
      roleId: assignment.roleId,
      roleName: assignment.role.name.toString(),
      assignedAt: new Date(),
    };
  }

  // ========== ENDPOINTS ESPECÍFICOS POR USUARIO ==========

  // GET /roles/user/:userId - Obtener roles de un usuario
  @Get('user/:userId')
  async getUserRoles(
    @Param('userId') userId: string,
  ): Promise<RoleResponseDto[]> {
    return this.rolesService.getUserRoles(userId);
  }

  // DELETE /roles/user/:userId/role/:roleId - Remover rol de usuario
  @Delete('user/:userId/role/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    return this.rolesService.removeRoleFromUser(userId, roleId);
  }

  // ========== ENDPOINTS POR TIPO DE ROL ==========

  // GET /roles/admins - Obtener todos los administradores
  @Get('type/admins')
  async getAdmins(): Promise<UserWithRolesDto[]> {
    const users: UserBasicInfo[] = await this.rolesService.getUsersByRole(
      RoleName.ADMIN,
    );

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status.toString(),
      roles: [{ id: '', name: 'ADMIN' }],
    }));
  }

  // GET /roles/students - Obtener todos los estudiantes
  @Get('type/students')
  async getStudents(): Promise<UserWithRolesDto[]> {
    const users: UserBasicInfo[] = await this.rolesService.getUsersByRole(
      RoleName.STUDENT,
    );

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status.toString(),
      roles: [{ id: '', name: 'STUDENT' }],
    }));
  }

  // ========== ENDPOINTS DE VERIFICACIÓN ==========

  // GET /roles/user/:userId/is-admin - Verificar si es admin
  @Get('user/:userId/is-admin')
  async isUserAdmin(
    @Param('userId') userId: string,
  ): Promise<{ isAdmin: boolean }> {
    const isAdmin = await this.rolesService.isUserAdmin(userId);
    return { isAdmin };
  }

  // GET /roles/user/:userId/is-student - Verificar si es estudiante
  @Get('user/:userId/is-student')
  async isUserStudent(
    @Param('userId') userId: string,
  ): Promise<{ isStudent: boolean }> {
    const isStudent = await this.rolesService.isUserStudent(userId);
    return { isStudent };
  }

  // GET /roles/user/:userId/names - Obtener nombres de roles (útil para auth)
  @Get('user/:userId/names')
  async getUserRoleNames(
    @Param('userId') userId: string,
  ): Promise<{ roles: RoleName[] }> {
    const roles = await this.rolesService.getUserRoleNames(userId);
    return { roles };
  }
}
