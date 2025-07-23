//update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
}

// DTO específico para excluir campos sensibles en respuestas
export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  createdAt: Date;
}
