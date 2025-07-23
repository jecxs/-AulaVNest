// course-categories/course-categories.controller.ts
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
import { CourseCategoriesService } from './course-categories.service';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';
import { QueryCourseCategoriesDto } from './dto/query-course-categories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('course-categories')
export class CourseCategoriesController {
  constructor(
    private readonly courseCategoriesService: CourseCategoriesService,
  ) {}

  // POST /course-categories - Crear categoría (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCourseCategoryDto: CreateCourseCategoryDto,
    @CurrentUser() user: any,
  ) {
    return this.courseCategoriesService.create(createCourseCategoryDto);
  }

  // GET /course-categories - Listar categorías con filtros (ADMIN ve todas, usuarios solo activas)
  @Get()
  async findAll(
    @Query() query: QueryCourseCategoriesDto,
    @CurrentUser() user?: any,
  ) {
    // Si hay usuario autenticado y es admin, puede ver todas
    // Si no es admin o no está autenticado, solo ve activas
    const isAdmin = user && user.roles && user.roles.includes(RoleName.ADMIN);

    if (!isAdmin) {
      query.isActive = true;
    }

    return this.courseCategoriesService.findAll(query);
  }

  // GET /course-categories/active - Categorías activas (público)
  @Get('active')
  async findActiveCategories() {
    return this.courseCategoriesService.findActiveCategories();
  }

  // GET /course-categories/popular - Categorías más populares (público)
  @Get('popular')
  async findPopularCategories(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 5;
    return this.courseCategoriesService.findPopularCategories(limitNumber);
  }

  // GET /course-categories/stats - Estadísticas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.courseCategoriesService.getCategoryStats();
  }

  // GET /course-categories/without-courses - Categorías sin cursos (Solo ADMIN)
  @Get('without-courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findWithoutCourses() {
    return this.courseCategoriesService.findCategoriesWithoutCourses();
  }

  // GET /course-categories/slug/:slug - Obtener categoría por slug (público)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.courseCategoriesService.findBySlug(slug);
  }

  // GET /course-categories/:id - Obtener categoría por ID
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const category = await this.courseCategoriesService.findOne(id);

    // Si no es admin, filtrar solo cursos públicos
    const isAdmin = user && user.roles && user.roles.includes(RoleName.ADMIN);
    if (!isAdmin && 'courses' in category && Array.isArray(category.courses)) {
      // Crear una copia del objeto y filtrar los cursos
      const filteredCategory = {
        ...category,
        courses: category.courses.filter(
          (course: any) => course.status === 'PUBLISHED',
        ),
      };
      return filteredCategory;
    }

    return category;
  }

  // PATCH /course-categories/:id - Actualizar categoría (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCourseCategoryDto: UpdateCourseCategoryDto,
  ) {
    return this.courseCategoriesService.update(id, updateCourseCategoryDto);
  }

  // PATCH /course-categories/:id/toggle-status - Activar/Desactivar categoría (Solo ADMIN)
  @Patch(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleActiveStatus(@Param('id') id: string) {
    return this.courseCategoriesService.toggleActiveStatus(id);
  }

  // DELETE /course-categories/:id - Eliminar categoría (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.courseCategoriesService.remove(id);
  }
}
