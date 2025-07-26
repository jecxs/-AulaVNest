// auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, AuthResponseDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  // Endpoint para development - crear admin rápido
  @Post('dev/create-admin')
  @HttpCode(HttpStatus.CREATED)
  async createDevAdmin(): Promise<{ message: string; credentials: any }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Only available in development');
    }

    // Lógica para crear admin de desarrollo
    return {
      message: 'Dev admin created',
      credentials: {
        email: 'admin@dev.com',
        password: 'dev123456',
      },
    };
  }
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

}
