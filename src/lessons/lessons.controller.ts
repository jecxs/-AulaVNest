// lessons/lessons.controller.ts
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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateVideoLessonDto } from './dto/create-video-lesson.dto';
import { CreateTextLessonDto } from './dto/create-text-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  // POST /lessons - Crear lesson manual (Solo ADMIN)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createLessonDto: CreateLessonDto,
    @CurrentUser() user: any,
  ) {
    return this.lessonsService.create(createLessonDto);
  }

  // POST /lessons/upload-video - Crear lesson con video (Bunny.net)
  @Post('upload-video')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB máximo
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('video/')) {
          return callback(
            new BadRequestException('Only video files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createVideoLesson(
    @Body() createVideoLessonDto: CreateVideoLessonDto,
    @UploadedFile() videoFile: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!videoFile) {
      throw new BadRequestException('Video file is required');
    }

    return this.lessonsService.createVideoLesson(
      createVideoLessonDto,
      videoFile,
    );
  }

  // POST /lessons/upload-text - Crear lesson de texto/PDF (Bunny.net)
  @Post('upload-text')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @UseInterceptors(
    FileInterceptor('pdf', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB máximo para PDFs
      },
      fileFilter: (req, file, callback) => {
        if (file && !file.mimetype.includes('pdf')) {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createTextLesson(
    @Body() createTextLessonDto: CreateTextLessonDto,
    @UploadedFile() pdfFile: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    // Validar que hay contenido (texto o archivo)
    if (!createTextLessonDto.markdownContent && !pdfFile) {
      throw new BadRequestException(
        'Text lessons must have markdown content or a PDF file',
      );
    }

    return this.lessonsService.createTextLesson(createTextLessonDto, pdfFile);
  }

  // GET /lessons - Listar lessons con filtros (Solo ADMIN)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async findAll(@Query() query: QueryLessonsDto) {
    return this.lessonsService.findAll(query);
  }

  // GET /lessons/stats - Estadísticas de lessons (Solo ADMIN)
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getStats() {
    return this.lessonsService.getLessonStats();
  }

  // GET /lessons/module/:moduleId - Lessons de un módulo específico
  @Get('module/:moduleId')
  @UseGuards(JwtAuthGuard)
  async findByModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: any,
  ) {
    return this.lessonsService.findByModule(moduleId);
  }

  // GET /lessons/module/:moduleId/next-order - Siguiente orden disponible
  @Get('module/:moduleId/next-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async getNextOrder(@Param('moduleId') moduleId: string) {
    const nextOrder = await this.lessonsService.getNextOrderForModule(moduleId);
    return { nextOrder };
  }

  // GET /lessons/:id - Obtener lesson por ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.lessonsService.findOne(id);
  }

  // PATCH /lessons/:id - Actualizar lesson (Solo ADMIN)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  // POST /lessons/:id/duplicate - Duplicar lesson (Solo ADMIN)
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(@Param('id') id: string) {
    return this.lessonsService.duplicateLesson(id);
  }

  // PATCH /lessons/module/:moduleId/reorder - Reordenar lessons (Solo ADMIN)
  @Patch('module/:moduleId/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reorderLessons(
    @Param('moduleId') moduleId: string,
    @Body() reorderDto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorderLessons(moduleId, reorderDto);
  }

  // DELETE /lessons/:id - Eliminar lesson (Solo ADMIN)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.lessonsService.remove(id);
  }

  // GET /lessons/:id/with-resources - Obtener lesson con sus resources
  @Get(':id/with-resources')
  @UseGuards(JwtAuthGuard)
  async findOneWithResources(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const lesson = await this.lessonsService.getLessonWithResources(id);

    // Si es estudiante, verificar acceso
    if (!user.roles.includes(RoleName.ADMIN)) {
      // Aquí puedes agregar verificación de enrollment si es necesario
      // por ahora dejamos que cualquier usuario autenticado vea
    }

    return lesson;
  }
}
