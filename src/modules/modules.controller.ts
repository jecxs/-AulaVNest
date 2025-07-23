// modules/modules.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { QueryModulesDto } from './dto/query-modules.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  // POST /modules - Crear módulo (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createModuleDto: CreateModuleDto,
    @CurrentUser() user: any,
  ) {
    return this.modulesService.create(createModuleDto);
  }

  // GET /modules - Listar módulos con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryModulesDto) {
    return this.modulesService.findAll(query);
  }

  // GET /modules/stats - Estadísticas de módulos (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.modulesService.getModuleStats();
  }

  // GET /modules/without-content - Módulos sin contenido (Solo ADMIN)
  @Get('without-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findWithoutContent() {
    return this.modulesService.findModulesWithoutContent();
  }

  // GET /modules/course/:courseId - Módulos de un curso específico
  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard)
  async findByCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    return this.modulesService.findByCourse(courseId);
  }

  // GET /modules/course/:courseId/next-order - Siguiente orden disponible
  @Get('course/:courseId/next-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getNextOrder(@Param('courseId') courseId: string) {
    const nextOrder = await this.modulesService.getNextOrderForCourse(courseId);
    return { nextOrder };
  }

  // GET /modules/:id - Obtener módulo por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.modulesService.findOne(id);
  }

  // PATCH /modules/:id - Actualizar módulo (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    return this.modulesService.update(id, updateModuleDto);
  }

  // POST /modules/:id/duplicate - Duplicar módulo (Solo ADMIN)
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(@Param('id') id: string) {
    return this.modulesService.duplicateModule(id);
  }

  // PATCH /modules/course/:courseId/reorder - Reordenar módulos (Solo ADMIN)
  @Patch('course/:courseId/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reorderModules(
    @Param('courseId') courseId: string,
    @Body() reorderDto: ReorderModulesDto,
  ) {
    return this.modulesService.reorderModules(courseId, reorderDto);
  }

  // DELETE /modules/:id - Eliminar módulo (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.modulesService.remove(id);
  }
}
