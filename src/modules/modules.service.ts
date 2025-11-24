// modules/modules.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Module, Prisma } from '@prisma/client';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { QueryModulesDto } from './dto/query-modules.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  // Crear módulo
  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: createModuleDto.courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verificar que no exista otro módulo con el mismo order en el curso
    const existingModule = await this.prisma.module.findFirst({
      where: {
        courseId: createModuleDto.courseId,
        order: createModuleDto.order,
      },
    });

    if (existingModule) {
      throw new ConflictException(
        `Module with order ${createModuleDto.order} already exists in this course`,
      );
    }

    try {
      return await this.prisma.module.create({
        data: createModuleDto,
        include: {
          course: {
            select: { id: true, title: true },
          },
          _count: {
            select: {
              lessons: true,
              quizzes: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Module with this order already exists in the course',
          );
        }
      }
      throw error;
    }
  }

  // Obtener todos los módulos con filtros
  async findAll(query: QueryModulesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      courseId,
      isRequired,
      sortBy = 'order',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ModuleWhereInput = {
      ...(courseId && { courseId }),
      ...(isRequired !== undefined && { isRequired }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Crear el orderBy de forma segura
    const orderBy: Prisma.ModuleOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.ModuleOrderByWithRelationInput] = sortOrder;

    const [modules, total] = await Promise.all([
      this.prisma.module.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          course: {
            select: { id: true, title: true },
          },
          _count: {
            select: {
              lessons: true,
              quizzes: true,
            },
          },
        },
      }),
      this.prisma.module.count({ where }),
    ]);

    return {
      data: modules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener módulos de un curso específico
  async findByCourse(courseId: string) {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            durationSec: true,
          },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            passingScore: true,
          },
        },
        _count: {
          select: {
            lessons: true,
            quizzes: true,
          },
        },
      },
    });
  }

  // Obtener módulo por ID
  async findOne(id: string): Promise<Module> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, title: true, status: true },
        },
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            durationSec: true,
          },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            passingScore: true,
          },
        },
        _count: {
          select: {
            lessons: true,
            quizzes: true,
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return module;
  }

  // Actualizar módulo
  async update(id: string, updateModuleDto: UpdateModuleDto): Promise<Module> {
    // Verificar que el módulo existe
    const existingModule = await this.findOne(id);

    // Si se actualiza el order, verificar que no exista conflicto
    if (
      updateModuleDto.order &&
      updateModuleDto.order !== existingModule.order
    ) {
      const conflictModule = await this.prisma.module.findFirst({
        where: {
          courseId: existingModule.courseId,
          order: updateModuleDto.order,
          NOT: { id },
        },
      });

      if (conflictModule) {
        throw new ConflictException(
          `Module with order ${updateModuleDto.order} already exists in this course`,
        );
      }
    }

    try {
      return await this.prisma.module.update({
        where: { id },
        data: updateModuleDto,
        include: {
          course: {
            select: { id: true, title: true },
          },
          _count: {
            select: {
              lessons: true,
              quizzes: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Module with this order already exists');
        }
      }
      throw error;
    }
  }

  // Reordenar módulos
  async reorderModules(
    courseId: string,
    reorderDto: ReorderModulesDto,
  ): Promise<Module[]> {
    // Verificar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verificar que todos los módulos pertenecen al curso
    const moduleIds = reorderDto.modules.map((m) => m.id);
    const existingModules = await this.prisma.module.findMany({
      where: {
        id: { in: moduleIds },
        courseId,
      },
    });

    if (existingModules.length !== moduleIds.length) {
      throw new BadRequestException(
        'Some modules do not belong to this course',
      );
    }

    // Verificar que no hay órdenes duplicados
    const orders = reorderDto.modules.map((m) => m.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Duplicate order values are not allowed');
    }

    // Realizar las actualizaciones en transacción
    const updatedModules = await this.prisma.$transaction(
      reorderDto.modules.map((moduleOrder) =>
        this.prisma.module.update({
          where: { id: moduleOrder.id },
          data: { order: moduleOrder.order },
        }),
      ),
    );

    // Retornar módulos ordenados
    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            lessons: true,
            quizzes: true,
          },
        },
      },
    });
  }

  // Eliminar módulo
  async remove(id: string): Promise<Module> {
    // Verificar que el módulo existe
    const module = await this.findOne(id);

    // Verificar que no tenga lessons o quizzes
    const [lessonsCount, quizzesCount] = await Promise.all([
      this.prisma.lesson.count({ where: { moduleId: id } }),
      this.prisma.quiz.count({ where: { moduleId: id } }),
    ]);

    if (lessonsCount > 0 || quizzesCount > 0) {
      throw new BadRequestException(
        `Cannot delete module with ${lessonsCount} lessons and ${quizzesCount} quizzes. Please delete the content first.`,
      );
    }

    return await this.prisma.module.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de módulos
  async getModuleStats() {
    const [total, required, optional, withContent] = await Promise.all([
      this.prisma.module.count(),
      this.prisma.module.count({ where: { isRequired: true } }),
      this.prisma.module.count({ where: { isRequired: false } }),
      this.prisma.module.count({
        where: {
          OR: [{ lessons: { some: {} } }, { quizzes: { some: {} } }],
        },
      }),
    ]);

    return {
      total,
      required,
      optional,
      withContent,
      withoutContent: total - withContent,
    };
  }

  // Obtener módulos sin contenido
  async findModulesWithoutContent() {
    return this.prisma.module.findMany({
      where: {
        AND: [{ lessons: { none: {} } }, { quizzes: { none: {} } }],
      },
      include: {
        course: {
          select: { title: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  // Duplicar módulo
  async duplicateModule(id: string): Promise<Module> {
    const originalModule = await this.findOne(id);

    // Obtener el siguiente número de orden disponible en el curso
    const maxOrder = await this.prisma.module.findFirst({
      where: { courseId: originalModule.courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (maxOrder?.order || 0) + 1;

    return await this.prisma.module.create({
      data: {
        title: `${originalModule.title} (Copia)`,
        description: originalModule.description,
        order: newOrder,
        isRequired: originalModule.isRequired,
        courseId: originalModule.courseId,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        _count: {
          select: {
            lessons: true,
            quizzes: true,
          },
        },
      },
    });
  }

  // Obtener siguiente orden disponible para un curso
  async getNextOrderForCourse(courseId: string): Promise<number> {
    const maxOrder = await this.prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (maxOrder?.order || 0) + 1;
  }
}
