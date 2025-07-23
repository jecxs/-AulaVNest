// instructors/instructors.controller.ts
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
import { InstructorsService } from './instructors.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { QueryInstructorsDto } from './dto/query-instructors.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  // POST /instructors - Crear instructor (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createInstructorDto: CreateInstructorDto,
    @CurrentUser() user: any,
  ) {
    return this.instructorsService.create(createInstructorDto);
  }

  // GET /instructors - Listar instructores con filtros
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryInstructorsDto) {
    return this.instructorsService.findAll(query);
  }

  // GET /instructors/public - Lista básica de instructores (sin autenticación)
  @Get('public')
  async findPublicList(@Query() query: QueryInstructorsDto) {
    const result = await this.instructorsService.findAll(query);

    // Filtrar información sensible para vista pública
    const publicData = result.data.map((instructor) => ({
      id: instructor.id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      bio: instructor.bio,
      specialization: instructor.specialization,
      experience: instructor.experience,
      linkedinUrl: instructor.linkedinUrl,
      _count: instructor._count,
    }));

    return {
      data: publicData,
      pagination: result.pagination,
    };
  }

  // GET /instructors/stats - Estadísticas (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.instructorsService.getInstructorStats();
  }

  // GET /instructors/without-courses - Instructores sin cursos (Solo ADMIN)
  @Get('without-courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findWithoutCourses() {
    return this.instructorsService.findInstructorsWithoutCourses();
  }

  // GET /instructors/top - Top instructores por número de cursos
  @Get('top')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findTopInstructors(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 5;
    return this.instructorsService.findTopInstructors(limitNumber);
  }

  // GET /instructors/specialization/:specialization - Por especialización
  @Get('specialization/:specialization')
  async findBySpecialization(@Param('specialization') specialization: string) {
    return this.instructorsService.findBySpecialization(specialization);
  }

  // GET /instructors/:id - Obtener instructor por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const instructor = await this.instructorsService.findOne(id);

    // Si no es admin, ocultar información sensible
    if (!user.roles.includes(RoleName.ADMIN)) {
      const { email, phone, ...publicInfo } = instructor;
      return publicInfo;
    }

    return instructor;
  }

  // GET /instructors/:id/courses - Cursos de un instructor
  @Get(':id/courses')
  @UseGuards(JwtAuthGuard)
  async getInstructorCourses(@Param('id') id: string) {
    return this.instructorsService.getInstructorCourses(id);
  }

  // PATCH /instructors/:id - Actualizar instructor (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateInstructorDto: UpdateInstructorDto,
  ) {
    return this.instructorsService.update(id, updateInstructorDto);
  }

  // DELETE /instructors/:id - Eliminar instructor (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.instructorsService.remove(id);
  }
}
