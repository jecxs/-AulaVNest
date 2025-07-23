//user-role-response.dto.ts
// DTOs para respuestas
export class RoleResponseDto {
  id: string;
  name: string;
}

export class UserWithRolesDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: RoleResponseDto[];
}

export class RoleWithUsersDto {
  id: string;
  name: string;
  users: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  }[];
}

export class UserRoleAssignmentDto {
  userId: string;
  roleId: string;
  roleName: string;
  assignedAt: Date;
}
