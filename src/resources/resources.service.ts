// resources/resources.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BunnyService } from '../shared/services/bunny.service';
import { Resource, Prisma, RoleName } from '@prisma/client';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UploadResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { QueryResourcesDto } from './dto/query-resources.dto';
import * as AdmZip from 'adm-zip';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private bunnyService: BunnyService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  // Crear resource básico (manual)
  async create(createResourceDto: CreateResourceDto): Promise<Resource> {
    // Verificar que la lesson existe
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: createResourceDto.lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    try {
      return await this.prisma.resource.create({
        data: createResourceDto,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: {
                  id: true,
                  title: true,
                  course: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to create resource');
    }
  }

  // Subir archivo como resource
  async uploadResource(
    uploadResourceDto: UploadResourceDto,
    file: Express.Multer.File,
  ): Promise<Resource> {
    // Verificar que la lesson existe
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: uploadResourceDto.lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    try {
      // Subir archivo a Bunny.net
      const fileUrl = await this.bunnyService.uploadFile(file);

      // Usar nombre personalizado si se proporciona
      const fileName = uploadResourceDto.customFileName || file.originalname;

      const resourceData: CreateResourceDto = {
        fileName: fileName,
        fileType: file.mimetype,
        fileUrl: fileUrl,
        sizeKb: Math.round(file.size / 1024),
        lessonId: uploadResourceDto.lessonId,
      };

      return this.create(resourceData);
    } catch (error) {
      console.error('Error uploading resource:', error);
      throw new BadRequestException('Failed to upload resource');
    }
  }

  // Obtener todos los resources con filtros
  async findAll(query: QueryResourcesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      lessonId,
      moduleId,
      courseId,
      fileType,
      sortBy = 'fileName',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ResourceWhereInput = {
      ...(lessonId && { lessonId }),
      ...(moduleId && { lesson: { moduleId } }),
      ...(courseId && { lesson: { module: { courseId } } }),
      ...(fileType && {
        fileType: { contains: fileType, mode: 'insensitive' },
      }),
      ...(search && {
        OR: [
          { fileName: { contains: search, mode: 'insensitive' } },
          { fileType: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ResourceOrderByWithRelationInput = {};
    orderBy[sortBy as keyof Prisma.ResourceOrderByWithRelationInput] =
      sortOrder;

    const [resources, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: {
                  id: true,
                  title: true,
                  course: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.resource.count({ where }),
    ]);

    return {
      data: resources.map((resource) => ({
        ...resource,
        downloadUrl: resource.fileUrl,
        isImage: this.isImageFile(resource.fileType),
        isPdf: resource.fileType === 'application/pdf',
        isZip: this.isZipFile(resource.fileType),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener resources de una lesson específica
  async findByLesson(lessonId: string) {
    // Verificar que la lesson existe
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const resources = await this.prisma.resource.findMany({
      where: { lessonId },
      orderBy: { fileName: 'asc' },
    });

    return resources.map((resource) => ({
      ...resource,
      downloadUrl: resource.fileUrl,
      isImage: this.isImageFile(resource.fileType),
      isPdf: resource.fileType === 'application/pdf',
      isZip: this.isZipFile(resource.fileType),
    }));
  }

  // Obtener resources de un módulo específico
  async findByModule(moduleId: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.resource.findMany({
      where: {
        lesson: { moduleId },
      },
      include: {
        lesson: {
          select: { id: true, title: true, order: true },
        },
      },
      orderBy: [{ lesson: { order: 'asc' } }, { fileName: 'asc' }],
    });
  }

  // Obtener resources de un curso específico
  async findByCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.resource.findMany({
      where: {
        lesson: {
          module: { courseId },
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            order: true,
            module: {
              select: { id: true, title: true, order: true },
            },
          },
        },
      },
      orderBy: [
        { lesson: { module: { order: 'asc' } } },
        { lesson: { order: 'asc' } },
        { fileName: 'asc' },
      ],
    });
  }

  // Obtener resource por ID
  async findOne(id: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: { id: true, title: true, status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    return resource;
  }

  // Actualizar resource
  async update(
    id: string,
    updateResourceDto: UpdateResourceDto,
  ): Promise<Resource> {
    // Verificar que el resource existe
    await this.findOne(id);

    try {
      return await this.prisma.resource.update({
        where: { id },
        data: updateResourceDto,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to update resource');
    }
  }

  // Eliminar resource
  async remove(id: string): Promise<Resource> {
    // Verificar que el resource existe
    const resource = await this.findOne(id);

    try {
      // Eliminar archivo de Bunny.net
      await this.bunnyService.deleteFile(resource.fileUrl);

      // Eliminar de la base de datos
      return await this.prisma.resource.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Error removing resource:', error);
      throw new BadRequestException('Failed to remove resource');
    }
  }

  // Duplicar resource a otra lesson
  async duplicateResource(
    id: string,
    targetLessonId: string,
  ): Promise<Resource> {
    const originalResource = await this.findOne(id);

    // Verificar que la lesson destino existe
    const targetLesson = await this.prisma.lesson.findUnique({
      where: { id: targetLessonId },
    });

    if (!targetLesson) {
      throw new NotFoundException('Target lesson not found');
    }

    const duplicatedData: CreateResourceDto = {
      fileName: `${originalResource.fileName} (Copia)`,
      fileType: originalResource.fileType,
      fileUrl: originalResource.fileUrl, // Mantener la misma URL
      sizeKb: originalResource.sizeKb || undefined, // Convertir null a undefined
      lessonId: targetLessonId,
    };

    return this.create(duplicatedData);
  }

  // Subida masiva desde ZIP
  async bulkUploadFromZip(
    lessonId: string,
    zipFile: Express.Multer.File,
  ): Promise<Resource[]> {
    // Verificar que la lesson existe
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    try {
      // Procesar archivo ZIP
      const zip = new AdmZip(zipFile.buffer);
      const zipEntries = zip.getEntries();

      const uploadedResources: Resource[] = [];

      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          // Crear buffer del archivo
          const fileBuffer = entry.getData();

          // Determinar tipo MIME basado en extensión
          const fileName = entry.entryName;
          const fileType = this.getMimeTypeFromFileName(fileName);

          // Crear objeto similar a Multer.File
          const fileData = {
            originalname: fileName,
            buffer: fileBuffer,
            size: fileBuffer.length,
            mimetype: fileType,
          } as Express.Multer.File;

          // Subir archivo individual
          const uploadDto: UploadResourceDto = {
            lessonId: lessonId,
            customFileName: fileName,
          };

          const resource = await this.uploadResource(uploadDto, fileData);
          uploadedResources.push(resource);
        }
      }

      return uploadedResources;
    } catch (error) {
      console.error('Error in bulk upload:', error);
      throw new BadRequestException('Failed to process ZIP file');
    }
  }

  // Eliminar todos los resources de una lesson
  async clearLessonResources(lessonId: string): Promise<{ deleted: number }> {
    // Verificar que la lesson existe
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Obtener todos los resources de la lesson
    const resources = await this.prisma.resource.findMany({
      where: { lessonId },
    });

    // Eliminar archivos de Bunny.net
    for (const resource of resources) {
      try {
        await this.bunnyService.deleteFile(resource.fileUrl);
      } catch (error) {
        console.error(`Failed to delete file ${resource.fileName}:`, error);
      }
    }

    // Eliminar resources de la base de datos
    const result = await this.prisma.resource.deleteMany({
      where: { lessonId },
    });

    return { deleted: result.count };
  }

  // Obtener estadísticas de resources
  async getResourceStats() {
    const [total, totalSize, byType] = await Promise.all([
      this.prisma.resource.count(),
      this.prisma.resource.aggregate({
        _sum: { sizeKb: true },
      }),
      this.prisma.resource.groupBy({
        by: ['fileType'],
        _count: { fileType: true },
        orderBy: { _count: { fileType: 'desc' } },
      }),
    ]);

    const totalSizeMB =
      Math.round(((totalSize._sum.sizeKb || 0) / 1024) * 100) / 100;

    return {
      total,
      totalSizeMB,
      byType: byType.map((item) => ({
        fileType: item.fileType,
        count: item._count.fileType,
      })),
    };
  }

  // Verificación de acceso - Lesson
  async checkUserAccessToLesson(
    lessonId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return; // Admins tienen acceso completo
    }

    // Obtener información de la lesson y curso
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // ✅ USAR SERVICIO INYECTADO
    const accessCheck = await this.enrollmentsService.checkUserAccessToCourse(
      lesson.module.courseId,
      userId,
    );

    if (!accessCheck.hasAccess) {
      throw new ForbiddenException(accessCheck.reason);
    }
  }

  // Verificación de acceso - Module
  async checkUserAccessToModule(
    moduleId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: userId,
        status: 'ACTIVE',
        course: {
          modules: {
            some: { id: moduleId },
          },
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this module');
    }
  }

  // Verificación de acceso - Course
  async checkUserAccessToCourse(
    courseId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    if (userRoles.includes(RoleName.ADMIN)) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: courseId,
        status: 'ACTIVE',
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You do not have access to this course');
    }
  }

  // Métodos utilitarios
  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private isZipFile(mimeType: string): boolean {
    return mimeType.includes('zip');
  }

  private getMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    const mimeTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
      zip: 'application/zip',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}
