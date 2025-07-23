// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { LoginDto, AuthResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!this.usersService.isUserActive(user)) {
      throw new UnauthorizedException('User account is suspended');
    }

    const userRoles = await this.rolesService.getUserRoleNames(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      roles: userRoles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: userRoles.map((role) => role.toString()),
      },
    };
  }

  async validateUser(payload: any) {
    const user = await this.usersService.findOne(payload.sub);
    if (user && this.usersService.isUserActive(user)) {
      return {
        id: user.id,
        email: user.email,
        roles: payload.roles,
      };
    }
    return null;
  }
}
