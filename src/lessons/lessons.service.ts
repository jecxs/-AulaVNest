// lessons/lessons.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BunnyService } from '../shared/services/bunny.service';
import { Lesson, LessonType, Prisma } from '@prisma/client';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateVideoLessonDto } from './dto/create-video-lesson.dto';
import { CreateTextLessonDto } from './dto/create-text-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';

@Injectable()
export class LessonsService {
  constructor(
    private prisma: PrismaService,
    private bunnyService: BunnyService, // Ahora sí está activo
  ) {}

  // Crear lesson básica (manual)
  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: createLessonDto.moduleId },
      include: { course: true },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Verificar que no exista otra lesson con el mismo order en el módulo
    const existingLesson = await this.prisma.lesson.findFirst({
      where: {
        moduleId: createLessonDto.moduleId,
        order: createLessonDto.order,
      },
    });

    if (existingLesson) {
      throw new ConflictException(
        `Lesson with order ${createLessonDto.order} already exists in this module`,
      );
    }

    // Validar contenido según tipo
    this.validateLessonContent(createLessonDto);

    try {
      return await this.prisma.lesson.create({
        data: createLessonDto,
        include: {
          module: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
          resources: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Lesson with this order already exists in the module',
          );
        }
      }
      throw error;
    }
  }

  // Crear lesson con video (integración Bunny.net)
  async createVideoLesson(
    createVideoLessonDto: CreateVideoLessonDto,
    videoFile: Express.Multer.File,
  ): Promise<Lesson> {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: createVideoLessonDto.moduleId },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Verificar orden único
    await this.checkOrderConflict(
      createVideoLessonDto.moduleId,
      createVideoLessonDto.order,
    );

    // Subir video a Bunny.net
    const videoUrl = await this.bunnyService.uploadVideo(videoFile);

    const lessonData: CreateLessonDto = {
      title: createVideoLessonDto.title,
      type: LessonType.VIDEO,
      order: createVideoLessonDto.order,
      durationSec: createVideoLessonDto.durationSec,
      videoUrl: videoUrl,
      moduleId: createVideoLessonDto.moduleId,
    };

    return this.create(lessonData);
  }

  // Crear lesson de texto/PDF (integración Bunny.net)
  async createTextLesson(
    createTextLessonDto: CreateTextLessonDto,
    pdfFile?: Express.Multer.File,
  ): Promise<Lesson> {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: createTextLessonDto.moduleId },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Verificar orden único
    await this.checkOrderConflict(
      createTextLessonDto.moduleId,
      createTextLessonDto.order,
    );

    // Crear la lesson
    const lessonData: CreateLessonDto = {
      title: createTextLessonDto.title,
      type: LessonType.TEXT,
      order: createTextLessonDto.order,
      markdownContent: createTextLessonDto.markdownContent,
      moduleId: createTextLessonDto.moduleId,
    };

    const lesson = await this.create(lessonData);

    // Si hay archivo PDF, subirlo y crear resource
    if (pdfFile) {
      // Subir PDF a Bunny.net
      const pdfUrl = await this.bunnyService.uploadFile(pdfFile);

      await this.prisma.resource.create({
        data: {
          fileName: pdfFile.originalname,
          fileType: pdfFile.mimetype,
          fileUrl: pdfUrl,
          sizeKb: Math.round(pdfFile.size / 1024),
          lessonId: lesson.id,
        },
      });
    }

    return this.findOne(lesson.id);
  }

  // Obtener todas las lessons con filtros
  async findAll(query: QueryLessonsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      moduleId,
      type,
      sortBy = 'order',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LessonWhereInput = {
      ...(moduleId && { moduleId }),
      ...(type && { type }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { markdownContent: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.LessonOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.LessonOrderByWithRelationInput] = sortOrder;

    const [lessons, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          module: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
          _count: {
            select: { resources: true },
          },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return {
      data: lessons.map((lesson) => ({
        ...lesson,
        hasVideo: !!lesson.videoUrl,
        hasResources: lesson._count.resources > 0,
        resourcesCount: lesson._count.resources,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener lessons de un módulo específico
  async findByModule(moduleId: string) {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        resources: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileUrl: true,
            sizeKb: true,
          },
        },
        _count: {
          select: { resources: true },
        },
      },
    });
  }

  // Obtener lesson por ID
  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        resources: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileUrl: true,
            sizeKb: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return lesson;
  }

  // Actualizar lesson
  async update(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    // Verificar que la lesson existe
    const existingLesson = await this.findOne(id);

    // Si se actualiza el order, verificar que no exista conflicto
    if (
      updateLessonDto.order &&
      updateLessonDto.order !== existingLesson.order
    ) {
      await this.checkOrderConflict(
        existingLesson.moduleId,
        updateLessonDto.order,
        id,
      );
    }

    // Validar contenido según tipo
    if (updateLessonDto.type) {
      this.validateLessonContent(updateLessonDto as CreateLessonDto);
    }

    try {
      return await this.prisma.lesson.update({
        where: { id },
        data: updateLessonDto,
        include: {
          module: {
            select: { id: true, title: true },
          },
          resources: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Lesson with this order already exists');
        }
      }
      throw error;
    }
  }

  // Reordenar lessons
  async reorderLessons(
    moduleId: string,
    reorderDto: ReorderLessonsDto,
  ): Promise<Lesson[]> {
    // Verificar que el módulo existe
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Verificar que todas las lessons pertenecen al módulo
    const lessonIds = reorderDto.lessons.map((l) => l.id);
    const existingLessons = await this.prisma.lesson.findMany({
      where: {
        id: { in: lessonIds },
        moduleId,
      },
    });

    if (existingLessons.length !== lessonIds.length) {
      throw new BadRequestException(
        'Some lessons do not belong to this module',
      );
    }

    // Verificar que no hay órdenes duplicados
    const orders = reorderDto.lessons.map((l) => l.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Duplicate order values are not allowed');
    }

    // Realizar las actualizaciones en transacción
    const updatedLessons = await this.prisma.$transaction(
      reorderDto.lessons.map((lessonOrder) =>
        this.prisma.lesson.update({
          where: { id: lessonOrder.id },
          data: { order: lessonOrder.order },
        }),
      ),
    );

    // Retornar lessons ordenadas
    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        resources: true,
      },
    });
  }

  // Eliminar lesson
  async remove(id: string): Promise<Lesson> {
    // Verificar que la lesson existe
    await this.findOne(id);

    // Las resources se eliminan automáticamente por CASCADE
    return await this.prisma.lesson.delete({
      where: { id },
    });
  }

  // Duplicar lesson
  // Alternativa más elegante (reemplaza el método completo si prefieres)
  async duplicateLesson(id: string): Promise<Lesson> {
    // Consulta específica que incluye resources con tipado correcto
    const originalLesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        resources: true,
      },
    });

    if (!originalLesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    // Obtener el siguiente número de orden disponible en el módulo
    const nextOrder = await this.getNextOrderForModule(originalLesson.moduleId);

    // Crear la lesson duplicada
    const duplicatedLesson = await this.prisma.lesson.create({
      data: {
        title: `${originalLesson.title} (Copia)`,
        type: originalLesson.type,
        order: nextOrder,
        durationSec: originalLesson.durationSec,
        videoUrl: originalLesson.videoUrl,
        markdownContent: originalLesson.markdownContent,
        moduleId: originalLesson.moduleId,
      },
    });

    // Duplicar resources si existen
    if (originalLesson.resources && originalLesson.resources.length > 0) {
      await this.prisma.resource.createMany({
        data: originalLesson.resources.map((resource) => ({
          fileName: resource.fileName,
          fileType: resource.fileType,
          fileUrl: resource.fileUrl,
          sizeKb: resource.sizeKb,
          lessonId: duplicatedLesson.id,
        })),
      });
    }

    return this.findOne(duplicatedLesson.id);
  }

  // Obtener estadísticas de lessons
  async getLessonStats() {
    const [total, videoLessons, textLessons, scormLessons] = await Promise.all([
      this.prisma.lesson.count(),
      this.prisma.lesson.count({ where: { type: LessonType.VIDEO } }),
      this.prisma.lesson.count({ where: { type: LessonType.TEXT } }),
      this.prisma.lesson.count({ where: { type: LessonType.SCORM } }),
    ]);

    return {
      total,
      byType: {
        video: videoLessons,
        text: textLessons,
        scorm: scormLessons,
      },
    };
  }

  // Obtener siguiente orden disponible para un módulo
  async getNextOrderForModule(moduleId: string): Promise<number> {
    const maxOrder = await this.prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (maxOrder?.order || 0) + 1;
  }

  // Métodos privados
  private async checkOrderConflict(
    moduleId: string,
    order: number,
    excludeId?: string,
  ): Promise<void> {
    const conflictLesson = await this.prisma.lesson.findFirst({
      where: {
        moduleId,
        order,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });

    if (conflictLesson) {
      throw new ConflictException(
        `Lesson with order ${order} already exists in this module`,
      );
    }
  }

  private validateLessonContent(lessonData: CreateLessonDto): void {
    if (lessonData.type === LessonType.VIDEO && !lessonData.videoUrl) {
      throw new BadRequestException('Video lessons must have a video URL');
    }

    if (lessonData.type === LessonType.TEXT && !lessonData.markdownContent) {
      // Para TEXT, el contenido puede estar en markdownContent O en resources (PDF)
      // Por eso no validamos aquí, se validará en el controller
    }
  }
  async getLessonWithResources(id: string): Promise<any> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        resources: {
          orderBy: { fileName: 'asc' },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileUrl: true,
            sizeKb: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return {
      ...lesson,
      resources: lesson.resources.map((resource) => ({
        ...resource,
        downloadUrl: resource.fileUrl,
        isImage: resource.fileType.startsWith('image/'),
        isPdf: resource.fileType === 'application/pdf',
        isZip: resource.fileType.includes('zip'),
      })),
    };
  }
}
