// course-categories/course-categories.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourseCategory, Prisma } from '@prisma/client';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';
import { QueryCourseCategoriesDto } from './dto/query-course-categories.dto';

@Injectable()
export class CourseCategoriesService {
  constructor(private prisma: PrismaService) {}

  // Crear categoría
  async create(
    createCourseCategoryDto: CreateCourseCategoryDto,
  ): Promise<CourseCategory> {
    // Verificar que el nombre no exista
    const existingCategory = await this.findByName(
      createCourseCategoryDto.name,
    );
    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    // Generar slug único
    const slug = await this.generateUniqueSlug(createCourseCategoryDto.name);

    try {
      return await this.prisma.courseCategory.create({
        data: {
          ...createCourseCategoryDto,
          slug,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Category with this name already exists');
        }
      }
      throw error;
    }
  }

  // Obtener todas las categorías con filtros y paginación
  async findAll(query: QueryCourseCategoriesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseCategoryWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Crear el orderBy de forma segura
    const orderBy: Prisma.CourseCategoryOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.CourseCategoryOrderByWithRelationInput] =
      sortOrder;

    const [categories, total] = await Promise.all([
      this.prisma.courseCategory.findMany({
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
      this.prisma.courseCategory.count({ where }),
    ]);

    return {
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener categorías activas (para frontend público)
  async findActiveCategories() {
    return this.prisma.courseCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            courses: {
              where: {
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Obtener categorías más populares (con más cursos)
  async findPopularCategories(limit: number = 5) {
    return this.prisma.courseCategory.findMany({
      where: {
        isActive: true,
        courses: {
          some: {
            status: 'PUBLISHED',
            visibility: 'PUBLIC',
          },
        },
      },
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
    });
  }

  // Obtener categoría por ID
  async findOne(id: string): Promise<CourseCategory> {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
      include: {
        courses: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            level: true,
            thumbnailUrl: true,
            price: true,
            createdAt: true,
            publishedAt: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
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

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  // Obtener categoría por slug
  async findBySlug(slug: string): Promise<CourseCategory> {
    const category = await this.prisma.courseCategory.findUnique({
      where: { slug },
      include: {
        courses: {
          where: {
            status: 'PUBLISHED',
            visibility: 'PUBLIC',
          },
          select: {
            id: true,
            title: true,
            slug: true,
            level: true,
            thumbnailUrl: true,
            price: true,
            estimatedHours: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: { enrollments: true },
            },
          },
          orderBy: { publishedAt: 'desc' },
        },
        _count: {
          select: { courses: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  // Obtener categoría por nombre
  async findByName(name: string): Promise<CourseCategory | null> {
    return this.prisma.courseCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  // Actualizar categoría
  async update(
    id: string,
    updateCourseCategoryDto: UpdateCourseCategoryDto,
  ): Promise<CourseCategory> {
    // Verificar que la categoría existe
    await this.findOne(id);

    // Si se actualiza el nombre, verificar que no exista y regenerar slug
    let updateData: any = { ...updateCourseCategoryDto };
    if (updateCourseCategoryDto.name) {
      const existingCategory = await this.findByName(
        updateCourseCategoryDto.name,
      );
      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
      updateData.slug = await this.generateUniqueSlug(
        updateCourseCategoryDto.name,
        id,
      );
    }

    try {
      return await this.prisma.courseCategory.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Category with this name already exists');
        }
      }
      throw error;
    }
  }

  // Activar/Desactivar categoría
  async toggleActiveStatus(id: string): Promise<CourseCategory> {
    const category = await this.findOne(id);

    return await this.prisma.courseCategory.update({
      where: { id },
      data: {
        isActive: !category.isActive,
      },
    });
  }

  // Eliminar categoría
  async remove(id: string): Promise<CourseCategory> {
    // Verificar que la categoría existe
    const category = await this.findOne(id);

    // Verificar que no tenga cursos asignados
    const coursesCount = await this.prisma.course.count({
      where: { categoryId: id },
    });

    if (coursesCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${coursesCount} assigned courses. Please reassign or delete the courses first.`,
      );
    }

    return await this.prisma.courseCategory.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de categorías
  async getCategoryStats() {
    const [total, active, inactive, withCourses] = await Promise.all([
      this.prisma.courseCategory.count(),
      this.prisma.courseCategory.count({ where: { isActive: true } }),
      this.prisma.courseCategory.count({ where: { isActive: false } }),
      this.prisma.courseCategory.count({
        where: {
          courses: {
            some: {},
          },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      withCourses,
      withoutCourses: total - withCourses,
    };
  }

  // Obtener categorías sin cursos
  async findCategoriesWithoutCourses() {
    return this.prisma.courseCategory.findMany({
      where: {
        courses: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // Métodos privados
  private async generateUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.slugify(name);
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
    const category = await this.prisma.courseCategory.findUnique({
      where: { slug },
      select: { id: true },
    });

    return category !== null && category.id !== excludeId;
  }
}
