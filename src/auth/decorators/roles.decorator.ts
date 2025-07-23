// auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@prisma/client';

export const Roles = (...roles: RoleName[]) => SetMetadata('roles', roles);
