//assign-role.dto.ts
import { IsString, IsEnum } from 'class-validator';
import { RoleName } from '@prisma/client';

export class AssignRoleDto {
  @IsString()
  userId: string;

  @IsEnum(RoleName, {
    message: 'Role name must be either STUDENT or ADMIN',
  })
  roleName: RoleName;
}

export class RemoveRoleDto {
  @IsString()
  userId: string;

  @IsString()
  roleId: string;
}
