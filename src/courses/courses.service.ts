// courses/courses.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Course,
  CourseStatus,
  CourseVisibility,
  EnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // Crear curso
  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    // Verificar que la categoría existe
    const category = await this.prisma.courseCategory.findUnique({
      where: { id: createCourseDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Course category not found');
    }

    // Verificar que el instructor existe
    const instructor = await this.prisma.instructor.findUnique({
      where: { id: createCourseDto.instructorId },
    });
    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    // Generar slug único
    const slug = await this.generateUniqueSlug(createCourseDto.title);

    try {
      return await this.prisma.course.create({
        data: {
          ...createCourseDto,
          slug,
          status: CourseStatus.DRAFT,
        },
        include: {
          category: true,
          instructor: true,
          _count: {
            select: {
              modules: true,
              enrollments: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Course with this title already exists');
        }
      }
      throw error;
    }
  }

  // Obtener todos los cursos con filtros y paginación
  async findAll(query: QueryCoursesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {
      ...filters,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Crear el orderBy de forma segura
    const orderBy: Prisma.CourseOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.CourseOrderByWithRelationInput] = sortOrder;

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          instructor: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data: courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  //método para obtener cursos del usuario:
  async getUserCourses(userId: string) {
    // Obtener enrollments activos del usuario
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: userId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: {
        course: {
          include: {
            category: {
              select: { name: true },
            },
            instructor: {
              select: { firstName: true, lastName: true },
            },
            _count: {
              select: { modules: true },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((enrollment) => ({
      enrollment: {
        id: enrollment.id,
        enrolledAt: enrollment.enrolledAt,
        expiresAt: enrollment.expiresAt,
        status: enrollment.status,
      },
      course: enrollment.course,
    }));
  }

  // Obtener cursos públicos (para estudiantes)
  async findPublicCourses(query: QueryCoursesDto) {
    return this.findAll({
      ...query,
      status: CourseStatus.PUBLISHED,
      visibility: CourseVisibility.PUBLIC,
    });
  }

  // Obtener curso por ID
  async findOne(id: string, includeCount: boolean = true): Promise<Course> {
    const includeOptions: any = {
      category: true,
      instructor: true,
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            select: { id: true, title: true, type: true, durationSec: true },
          },
          quizzes: {
            select: { id: true, title: true, passingScore: true },
          },
        },
      },
    };

    if (includeCount) {
      includeOptions._count = {
        select: {
          modules: true,
          enrollments: true,
          liveSessions: true,
        },
      };
    }

    const course = await this.prisma.course.findUnique({
      where: { id },
      include: includeOptions,
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  // Obtener curso por slug
  async findBySlug(slug: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        category: true,
        instructor: true,
        modules: {
          where: { isRequired: true },
          orderBy: { order: 'asc' },
          select: { id: true, title: true, order: true },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with slug ${slug} not found`);
    }

    return course;
  }

  // Actualizar curso
  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    await this.findOne(id); // Verificar que existe

    // Si se actualiza el título, regenerar slug
    let updateData: any = { ...updateCourseDto };
    if (updateCourseDto.title) {
      updateData.slug = await this.generateUniqueSlug(
        updateCourseDto.title,
        id,
      );
    }

    try {
      return await this.prisma.course.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          instructor: true,
          _count: {
            select: { modules: true, enrollments: true },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Course with this title already exists');
        }
      }
      throw error;
    }
  }

  // Método publishCourse actualizado
  async publishCourse(id: string): Promise<Course> {
    // Validar que el curso existe y puede ser publicado
    await this.validateCourseForPublication(id);

    return await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        visibility: CourseVisibility.PUBLIC,
      },
      include: {
        category: true,
        instructor: true,
      },
    });
  }

  // Método para validar si un curso puede ser publicado
  private async validateCourseForPublication(id: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            modules: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    if (course._count.modules === 0) {
      throw new BadRequestException(
        'Course must have at least one module to be published',
      );
    }
  }

  // Archivar curso
  async archiveCourse(id: string): Promise<Course> {
    await this.findOne(id);

    return await this.prisma.course.update({
      where: { id },
      data: {
        status: CourseStatus.ARCHIVED,
        visibility: CourseVisibility.PRIVATE,
      },
    });
  }

  // Eliminar curso (soft delete)
  async remove(id: string): Promise<Course> {
    const course = await this.findOne(id);

    // Verificar que no tenga enrollments activos
    const activeEnrollments = await this.prisma.enrollment.count({
      where: {
        courseId: id,
        status: 'ACTIVE',
      },
    });

    if (activeEnrollments > 0) {
      throw new BadRequestException(
        'Cannot delete course with active enrollments',
      );
    }

    return await this.archiveCourse(id);
  }

  // Obtener estadísticas de cursos
  async getCourseStats() {
    const [total, published, draft, archived] = await Promise.all([
      this.prisma.course.count(),
      this.prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
      this.prisma.course.count({ where: { status: CourseStatus.DRAFT } }),
      this.prisma.course.count({ where: { status: CourseStatus.ARCHIVED } }),
    ]);

    return { total, published, draft, archived };
  }

  // Obtener cursos por instructor
  async findByInstructor(instructorId: string, query: QueryCoursesDto) {
    return this.findAll({ ...query, instructorId });
  }

  // Obtener cursos por categoría
  async findByCategory(categoryId: string, query: QueryCoursesDto) {
    return this.findAll({ ...query, categoryId });
  }

  // Métodos privados
  private async generateUniqueSlug(
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
      .replace(/[\s_-]+/g, '-') // Reemplazar espacios y guiones
      .replace(/^-+|-+$/g, ''); // Remover guiones al inicio y final
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: { id: true },
    });

    return course !== null && course.id !== excludeId;
  }
  async getCourseStatistics(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            modules: true,
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Estadísticas de enrollments
    const [
      activeEnrollments,
      completedEnrollments,
      suspendedEnrollments,
      expiredEnrollments,
      paymentPending,
      recentEnrollments,
    ] = await Promise.all([
      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.ACTIVE },
      }),
      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.COMPLETED },
      }),
      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.SUSPENDED },
      }),
      this.prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.EXPIRED },
      }),
      this.prisma.enrollment.count({
        where: { courseId, paymentConfirmed: false },
      }),
      this.prisma.enrollment.count({
        where: {
          courseId,
          enrolledAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Total de lecciones en el curso
    const totalLessons = await this.prisma.lesson.count({
      where: { module: { courseId } },
    });

    // Progreso promedio del curso
    const enrollmentsWithProgress = await this.prisma.enrollment.findMany({
      where: {
        courseId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      include: {
        progress: {
          where: { completedAt: { not: null } },
        },
      },
    });

    let totalCompletionRate = 0;
    let studentsWithProgress = 0;

    enrollmentsWithProgress.forEach((enrollment) => {
      if (totalLessons > 0) {
        const completionRate =
          (enrollment.progress.length / totalLessons) * 100;
        totalCompletionRate += completionRate;
        studentsWithProgress++;
      }
    });

    const averageCompletionRate =
      studentsWithProgress > 0
        ? Math.round(totalCompletionRate / studentsWithProgress)
        : 0;

    // Estudiantes más activos (últimos 7 días)
    const recentActivity = await this.prisma.progress.findMany({
      where: {
        lesson: { module: { courseId } },
        completedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      distinct: ['enrollmentId'],
    });

    return {
      totalStudents: course._count.enrollments,
      totalModules: course._count.modules,
      totalLessons,
      enrollmentStats: {
        active: activeEnrollments,
        completed: completedEnrollments,
        suspended: suspendedEnrollments,
        expired: expiredEnrollments,
      },
      paymentStats: {
        confirmed: course._count.enrollments - paymentPending,
        pending: paymentPending,
      },
      progressStats: {
        averageCompletionRate,
        studentsWithProgress,
      },
      activityStats: {
        recentEnrollments: recentEnrollments,
        activeStudentsLast7Days: recentActivity.length,
      },
    };
  }
}
