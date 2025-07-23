//users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UserResponseDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users - Crear nuevo usuario
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.excludePassword(user);
  }

  // GET /users - Obtener todos los usuarios
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => this.excludePassword(user));
  }

  // GET /users/stats - Obtener estadísticas
  @Get('stats')
  async getStats() {
    return this.usersService.getUserStats();
  }

  // GET /users/:id - Obtener usuario por ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return this.excludePassword(user);
  }

  // PATCH /users/:id - Actualizar usuario
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    return this.excludePassword(user);
  }

  // PATCH /users/:id/suspend - Suspender usuario
  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.suspendUser(id);
    return this.excludePassword(user);
  }

  // PATCH /users/:id/activate - Activar usuario
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.activateUser(id);
    return this.excludePassword(user);
  }

  // DELETE /users/:id - Eliminar usuario (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.remove(id);
    return this.excludePassword(user);
  }

  // Método privado para excluir contraseña de las respuestas
  private excludePassword(user: any): UserResponseDto {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
