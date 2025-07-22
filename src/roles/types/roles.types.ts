import { Role, User, UserRole, RoleName, UserStatus } from '@prisma/client';

// ========== TIPOS BASE PARA RESPUESTAS ==========

export interface UserBasicInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
}

export interface RoleBasicInfo {
  id: string;
  name: RoleName;
}

// ========== TIPOS PARA RELACIONES PRISMA ==========

export interface UserRoleWithUser extends UserRole {
  user: UserBasicInfo;
}

export interface UserRoleWithRole extends UserRole {
  role: RoleBasicInfo;
}

export interface RoleWithUsers extends Role {
  users: UserRoleWithUser[];
}

export interface UserWithRoles extends User {
  roles: UserRoleWithRole[];
}

export interface RoleWithCount extends Role {
  _count: {
    users: number;
  };
}

// ========== TIPOS PARA RESPUESTAS DEL SERVICE ==========

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  user: UserBasicInfo;
  role: RoleBasicInfo;
}

export interface RoleStatsResponse {
  totalRoles: number;
  assignments: {
    admin: number;
    student: number;
    total: number;
  };
}

// ========== TIPOS PARA EL CONTROLLER ==========

export interface ControllerUserWithRoles {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: Array<{
    id: string;
    name: string;
  }>;
}

export interface ControllerRoleWithUsers {
  id: string;
  name: string;
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  }>;
}
