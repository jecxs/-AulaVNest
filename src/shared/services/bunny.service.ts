// shared/services/bunny.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class BunnyService {
  private readonly storageApiUrl = `https://${process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com'}`;
  private readonly cdnUrl =
    process.env.BUNNY_CDN_URL || 'https://aula-virtual.b-cdn.net';

  constructor() {
    // Validar que las variables de entorno estén configuradas
    if (
      !process.env.BUNNY_STORAGE_PASSWORD ||
      !process.env.BUNNY_STORAGE_ZONE
    ) {
      console.warn('Bunny.net credentials not configured');
    }
  }

  // Subir video a Bunny.net Storage
  async uploadVideo(videoFile: Express.Multer.File): Promise<string> {
    try {
      const fileName = this.generateFileName(videoFile.originalname, 'video');
      const uploadPath = `videos/${fileName}`;

      // Subir archivo a Bunny.net Storage
      await this.uploadToBunnyStorage(
        uploadPath,
        videoFile.buffer,
        videoFile.mimetype,
      );

      // Retornar la URL pública del CDN
      return `${this.cdnUrl}/${uploadPath}`;
    } catch (error) {
      console.error('Error uploading video to Bunny.net:', error);
      throw new BadRequestException('Failed to upload video');
    }
  }

  // Subir archivo (PDF, imágenes, etc.) a Bunny.net Storage
  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const fileName = this.generateFileName(file.originalname, 'document');
      const uploadPath = `documents/${fileName}`;

      // Subir archivo a Bunny.net Storage
      await this.uploadToBunnyStorage(uploadPath, file.buffer, file.mimetype);

      // Retornar la URL pública del CDN
      return `${this.cdnUrl}/${uploadPath}`;
    } catch (error) {
      console.error('Error uploading file to Bunny.net:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  // Eliminar archivo de Bunny.net Storage
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extraer el path del archivo desde la URL
      const filePath = this.extractPathFromUrl(fileUrl);

      const response = await axios.delete(
        `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${filePath}`,
        {
          headers: {
            AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          },
        },
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error deleting file from Bunny.net:', error);
      return false;
    }
  }

  // Método privado para subir a Bunny.net Storage
  private async uploadToBunnyStorage(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const response = await axios.put(
      `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${path}`,
      buffer,
      {
        headers: {
          AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          'Content-Type': mimeType,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    if (response.status !== 201) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  }

  // Generar nombre único para el archivo
  private generateFileName(
    originalName: string,
    type: 'video' | 'document',
  ): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();

    return `${type}-${timestamp}-${randomString}.${extension}`;
  }

  // Extraer path del archivo desde la URL del CDN
  private extractPathFromUrl(fileUrl: string): string {
    // Ejemplo: https://aula-virtual.b-cdn.net/videos/video-123.mp4 -> videos/video-123.mp4
    return fileUrl.replace(`${this.cdnUrl}/`, '');
  }

  // Validar configuración de Bunny.net
  isConfigured(): boolean {
    return !!(
      process.env.BUNNY_STORAGE_PASSWORD && process.env.BUNNY_STORAGE_ZONE
    );
  }

  // Obtener información del archivo
  async getFileInfo(fileUrl: string): Promise<any> {
    try {
      const filePath = this.extractPathFromUrl(fileUrl);

      const response = await axios.get(
        `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${filePath}`,
        {
          headers: {
            AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          },
        },
      );

      return {
        exists: true,
        size: response.headers['content-length'],
        lastModified: response.headers['last-modified'],
        contentType: response.headers['content-type'],
      };
    } catch (error) {
      return { exists: false };
    }
  }
  // Obtener metadatos de un archivo
  async getFileMetadata(fileUrl: string): Promise<any> {
    try {
      const filePath = this.extractPathFromUrl(fileUrl);

      const response = await axios.head(
        `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${filePath}`,
        {
          headers: {
            AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          },
        },
      );

      return {
        exists: true,
        size: parseInt(response.headers['content-length'] || '0'),
        lastModified: response.headers['last-modified'],
        contentType: response.headers['content-type'],
        etag: response.headers.etag,
      };
    } catch (error) {
      return { exists: false };
    }
  }

  // Validar que un archivo existe en Bunny.net
  async validateFileExists(fileUrl: string): Promise<boolean> {
    const metadata = await this.getFileMetadata(fileUrl);
    return metadata.exists;
  }

  // Obtener URL firmada para descarga directa (opcional)
  generateSecureDownloadUrl(
    fileUrl: string,
    expirationMinutes: number = 60,
  ): string {
    // Para implementación futura con URLs firmadas
    // Por ahora retorna la URL directa
    return fileUrl;
  }

  // Listar archivos en un directorio
  async listFiles(directory: string = ''): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${directory}`,
        {
          headers: {
            AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }
}
