// shared/decorators/require-enrollment.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequireEnrollment = () => SetMetadata('require-enrollment', true);
