//shared/guards/enrollment-access.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnrollmentsService } from '../../enrollments/enrollments.service';

@Injectable()
export class EnrollmentAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private enrollmentsService: EnrollmentsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Si es admin, permitir acceso
    if (user.roles && user.roles.includes('ADMIN')) {
      return true;
    }

    // Obtener courseId del parámetro de la request
    const courseId = request.params.courseId;
    if (!courseId) {
      throw new ForbiddenException('Course ID is required');
    }

    // Verificar acceso usando EnrollmentsService
    const accessCheck = await this.enrollmentsService.checkUserAccessToCourse(
      courseId,
      user.id,
    );

    if (!accessCheck.hasAccess) {
      throw new ForbiddenException(accessCheck.reason);
    }

    return true;
  }
}
