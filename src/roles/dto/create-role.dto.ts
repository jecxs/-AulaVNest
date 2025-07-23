//create-role.dto.ts
import { IsEnum } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateRoleDto {
  @IsEnum(RoleName, {
    message: 'Role name must be either STUDENT or ADMIN',
  })
  name: RoleName;
}
