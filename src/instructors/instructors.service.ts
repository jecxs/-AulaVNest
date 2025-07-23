// instructors/instructors.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Instructor, Prisma } from '@prisma/client';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';
import { QueryInstructorsDto } from './dto/query-instructors.dto';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  // Crear instructor
  async create(createInstructorDto: CreateInstructorDto): Promise<Instructor> {
    // Verificar que el email no exista (si se proporciona)
    if (createInstructorDto.email) {
      const existingInstructor = await this.findByEmail(
        createInstructorDto.email,
      );
      if (existingInstructor) {
        throw new ConflictException(
          'Instructor with this email already exists',
        );
      }
    }

    try {
      return await this.prisma.instructor.create({
        data: createInstructorDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Instructor with this email already exists',
          );
        }
      }
      throw error;
    }
  }

  // Obtener todos los instructores con filtros y paginación
  async findAll(query: QueryInstructorsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      specialization,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InstructorWhereInput = {
      ...(specialization && {
        specialization: { contains: specialization, mode: 'insensitive' },
      }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { specialization: { contains: search, mode: 'insensitive' } },
          { bio: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Crear el orderBy de forma segura
    const orderBy: Prisma.InstructorOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.InstructorOrderByWithRelationInput] =
      sortOrder;

    const [instructors, total] = await Promise.all([
      this.prisma.instructor.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { courses: true },
          },
        },
      }),
      this.prisma.instructor.count({ where }),
    ]);

    return {
      data: instructors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener instructor por ID
  async findOne(id: string): Promise<Instructor> {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id },
      include: {
        courses: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            level: true,
            createdAt: true,
            _count: {
              select: { enrollments: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { courses: true },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException(`Instructor with ID ${id} not found`);
    }

    return instructor;
  }

  // Obtener instructor por email
  async findByEmail(email: string): Promise<Instructor | null> {
    return this.prisma.instructor.findFirst({
      where: { email },
    });
  }

  // Actualizar instructor
  async update(
    id: string,
    updateInstructorDto: UpdateInstructorDto,
  ): Promise<Instructor> {
    // Verificar que el instructor existe
    await this.findOne(id);

    // Si se actualiza el email, verificar que no exista
    if (updateInstructorDto.email) {
      const existingInstructor = await this.findByEmail(
        updateInstructorDto.email,
      );
      if (existingInstructor && existingInstructor.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    try {
      return await this.prisma.instructor.update({
        where: { id },
        data: updateInstructorDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email already exists');
        }
      }
      throw error;
    }
  }

  // Eliminar instructor
  async remove(id: string): Promise<Instructor> {
    // Verificar que el instructor existe
    const instructor = await this.findOne(id);

    // Verificar que no tenga cursos asignados
    const coursesCount = await this.prisma.course.count({
      where: { instructorId: id },
    });

    if (coursesCount > 0) {
      throw new BadRequestException(
        `Cannot delete instructor with ${coursesCount} assigned courses. Please reassign or delete the courses first.`,
      );
    }

    return await this.prisma.instructor.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de instructores
  async getInstructorStats() {
    const [total, withCourses, totalCourses] = await Promise.all([
      this.prisma.instructor.count(),
      this.prisma.instructor.count({
        where: {
          courses: {
            some: {},
          },
        },
      }),
      this.prisma.course.count(),
    ]);

    const averageCoursesPerInstructor =
      withCourses > 0
        ? Math.round((totalCourses / withCourses) * 100) / 100
        : 0;

    return {
      total,
      withCourses,
      withoutCourses: total - withCourses,
      totalCourses,
      averageCoursesPerInstructor,
    };
  }

  // Obtener instructores sin cursos asignados
  async findInstructorsWithoutCourses() {
    return this.prisma.instructor.findMany({
      where: {
        courses: {
          none: {},
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        specialization: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Obtener instructores más activos (con más cursos)
  async findTopInstructors(limit: number = 5) {
    return this.prisma.instructor.findMany({
      take: limit,
      include: {
        _count: {
          select: { courses: true },
        },
      },
      orderBy: {
        courses: {
          _count: 'desc',
        },
      },
      where: {
        courses: {
          some: {},
        },
      },
    });
  }

  // Buscar instructores por especialización
  async findBySpecialization(specialization: string) {
    return this.prisma.instructor.findMany({
      where: {
        specialization: {
          contains: specialization,
          mode: 'insensitive',
        },
      },
      include: {
        _count: {
          select: { courses: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  // Obtener cursos de un instructor específico
  async getInstructorCourses(instructorId: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id: instructorId },
      include: {
        courses: {
          include: {
            category: {
              select: { name: true, slug: true },
            },
            _count: {
              select: { enrollments: true, modules: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException(
        `Instructor with ID ${instructorId} not found`,
      );
    }

    return instructor.courses;
  }
}
