// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // En desarrollo, permitir bypass si hay header especial
    if (process.env.NODE_ENV === 'development') {
      const request = context.switchToHttp().getRequest();
      const bypassAuth = request.headers['x-dev-bypass-auth'];
      if (bypassAuth === 'true') {
        // Simular usuario admin para testing
        request.user = {
          id: 'dev-admin-id',
          email: 'admin@dev.com',
          roles: ['ADMIN'],
        };
        return true;
      }
    }

    return super.canActivate(context);
  }
}
