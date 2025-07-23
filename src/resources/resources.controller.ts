// resources/resources.controller.ts
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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UploadResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { QueryResourcesDto } from './dto/query-resources.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // POST /resources - Crear resource manual (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createResourceDto: CreateResourceDto,
    @CurrentUser() user: any,
  ) {
    return this.resourcesService.create(createResourceDto);
  }

  // POST /resources/upload - Subir archivo como resource (Solo ADMIN)
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB máximo
      },
      fileFilter: (req, file, callback) => {
        // Tipos de archivo permitidos
        const allowedTypes = [
          'application/pdf',
          'application/zip',
          'application/x-zip-compressed',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/gif',
          'text/plain',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'File type not allowed. Supported types: PDF, ZIP, Office documents, Images, Text files',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadResource(
    @Body() uploadResourceDto: UploadResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.resourcesService.uploadResource(uploadResourceDto, file);
  }

  // GET /resources - Listar resources con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryResourcesDto) {
    return this.resourcesService.findAll(query);
  }

  // GET /resources/stats - Estadísticas de resources (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.resourcesService.getResourceStats();
  }

  // GET /resources/lesson/:lessonId - Resources de una lesson específica
  @Get('lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  async findByLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: any,
  ) {
    // Verificar que el usuario tiene acceso a la lesson
    await this.resourcesService.checkUserAccessToLesson(
      lessonId,
      user.id,
      user.roles,
    );
    return this.resourcesService.findByLesson(lessonId);
  }

  // GET /resources/module/:moduleId - Resources de un módulo específico
  @Get('module/:moduleId')
  @UseGuards(JwtAuthGuard)
  async findByModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: any,
  ) {
    // Verificar que el usuario tiene acceso al módulo
    await this.resourcesService.checkUserAccessToModule(
      moduleId,
      user.id,
      user.roles,
    );
    return this.resourcesService.findByModule(moduleId);
  }

  // GET /resources/course/:courseId - Resources de un curso específico
  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard)
  async findByCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
  ) {
    // Verificar que el usuario tiene acceso al curso
    await this.resourcesService.checkUserAccessToCourse(
      courseId,
      user.id,
      user.roles,
    );
    return this.resourcesService.findByCourse(courseId);
  }

  // GET /resources/:id - Obtener resource por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const resource = await this.resourcesService.findOne(id);

    // Verificar acceso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.resourcesService.checkUserAccessToLesson(
        resource.lessonId,
        user.id,
        user.roles,
      );
    }

    return resource;
  }

  // GET /resources/:id/download - Descargar resource
  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadResource(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resource = await this.resourcesService.findOne(id);

    // Verificar acceso para estudiantes
    if (!user.roles.includes(RoleName.ADMIN)) {
      await this.resourcesService.checkUserAccessToLesson(
        resource.lessonId,
        user.id,
        user.roles,
      );
    }

    // Configurar headers para descarga
    res.set({
      'Content-Type': resource.fileType,
      'Content-Disposition': `attachment; filename="${resource.fileName}"`,
    });

    // Retornar URL de descarga directa desde Bunny.net
    return { downloadUrl: resource.fileUrl };
  }

  // PATCH /resources/:id - Actualizar resource (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateResourceDto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(id, updateResourceDto);
  }

  // POST /resources/:id/duplicate - Duplicar resource a otra lesson (Solo ADMIN)
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id') id: string,
    @Body('targetLessonId') targetLessonId: string,
  ) {
    if (!targetLessonId) {
      throw new BadRequestException('Target lesson ID is required');
    }

    return this.resourcesService.duplicateResource(id, targetLessonId);
  }

  // POST /resources/bulk-upload - Subida masiva de archivos (Solo ADMIN)
  @Post('bulk-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(FileInterceptor('zipFile'))
  @HttpCode(HttpStatus.CREATED)
  async bulkUpload(
    @Body('lessonId') lessonId: string,
    @UploadedFile() zipFile: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!zipFile || !zipFile.mimetype.includes('zip')) {
      throw new BadRequestException('ZIP file is required');
    }

    return this.resourcesService.bulkUploadFromZip(lessonId, zipFile);
  }

  // DELETE /resources/:id - Eliminar resource (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }

  // DELETE /resources/lesson/:lessonId/clear - Eliminar todos los resources de una lesson (Solo ADMIN)
  @Delete('lesson/:lessonId/clear')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async clearLessonResources(@Param('lessonId') lessonId: string) {
    return this.resourcesService.clearLessonResources(lessonId);
  }
}
