// courses/courses.controller.ts
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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // POST /courses - Crear curso (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @CurrentUser() user: any,
  ) {
    return this.coursesService.create(createCourseDto);
  }

  // GET /courses - Listar cursos con filtros (ADMIN ve todos, estudiantes solo públicos)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(@Query() query: QueryCoursesDto, @CurrentUser() user: any) {
    // Si es admin, puede ver todos los cursos
    if (user.roles.includes(RoleName.ADMIN)) {
      return this.coursesService.findAll(query);
    }

    // Si es estudiante, solo cursos públicos
    return this.coursesService.findPublicCourses(query);
  }

  // GET /courses/public - Cursos públicos (sin autenticación)
  @Get('public')
  async findPublicCourses(@Query() query: QueryCoursesDto) {
    return this.coursesService.findPublicCourses(query);
  }

  // GET /courses/stats - Estadísticas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.coursesService.getCourseStats();
  }

  // GET /courses/instructor/:instructorId - Cursos por instructor
  @Get('instructor/:instructorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findByInstructor(
    @Param('instructorId') instructorId: string,
    @Query() query: QueryCoursesDto,
  ) {
    return this.coursesService.findByInstructor(instructorId, query);
  }

  // GET /courses/category/:categoryId - Cursos por categoría
  @Get('category/:categoryId')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: QueryCoursesDto,
  ) {
    return this.coursesService.findByCategory(categoryId, query);
  }

  // GET /courses/slug/:slug - Obtener curso por slug (público)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.coursesService.findBySlug(slug);
  }

  // GET /courses/:id - Obtener curso por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.findOne(id);
  }

  // PATCH /courses/:id - Actualizar curso (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, updateCourseDto);
  }

  // PATCH /courses/:id/publish - Publicar curso (Solo ADMIN)
  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publishCourse(@Param('id') id: string) {
    return this.coursesService.publishCourse(id);
  }

  // PATCH /courses/:id/archive - Archivar curso (Solo ADMIN)
  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async archiveCourse(@Param('id') id: string) {
    return this.coursesService.archiveCourse(id);
  }

  // DELETE /courses/:id - Eliminar curso (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}
