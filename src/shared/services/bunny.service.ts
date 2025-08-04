// shared/services/bunny.service.ts - AJUSTE MENOR
import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class BunnyService {
  private readonly storageApiUrl = `https://${process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com'}`;
  private readonly cdnUrl =
    process.env.BUNNY_CDN_URL || 'https://aula-virtual-cdn.b-cdn.net'; // ← ACTUALIZADO

  constructor() {
    // Validar que las variables de entorno estén configuradas
    if (
      !process.env.BUNNY_STORAGE_PASSWORD ||
      !process.env.BUNNY_STORAGE_ZONE
    ) {
      console.warn('Bunny.net credentials not configured');
    }

    // ← NUEVO: Log para verificar configuración
    console.log('🐰 Bunny CDN URL:', this.cdnUrl);
    console.log('🐰 Bunny Storage Zone:', process.env.BUNNY_STORAGE_ZONE);
  }

  // Subir video a Bunny.net Storage
  async uploadVideo(videoFile: Express.Multer.File): Promise<string> {
    try {
      const fileName = this.generateFileName(videoFile.originalname, 'video');
      const uploadPath = `videos/${fileName}`;

      console.log('🎬 Uploading video:', uploadPath); // ← Debug log

      // Subir archivo a Bunny.net Storage
      await this.uploadToBunnyStorage(
        uploadPath,
        videoFile.buffer,
        videoFile.mimetype,
      );

      // Retornar la URL pública del CDN
      const publicUrl = `${this.cdnUrl}/${uploadPath}`;
      console.log('✅ Video uploaded, public URL:', publicUrl); // ← Debug log

      return publicUrl;
    } catch (error) {
      console.error('❌ Error uploading video to Bunny.net:', error);
      throw new BadRequestException('Failed to upload video');
    }
  }

  // Subir archivo (PDF, imágenes, etc.) a Bunny.net Storage
  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const fileName = this.generateFileName(file.originalname, 'document');
      const uploadPath = `documents/${fileName}`;

      console.log('📄 Uploading file:', uploadPath); // ← Debug log

      // Subir archivo a Bunny.net Storage
      await this.uploadToBunnyStorage(uploadPath, file.buffer, file.mimetype);

      // Retornar la URL pública del CDN
      const publicUrl = `${this.cdnUrl}/${uploadPath}`;
      console.log('✅ File uploaded, public URL:', publicUrl); // ← Debug log

      return publicUrl;
    } catch (error) {
      console.error('❌ Error uploading file to Bunny.net:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  // ← NUEVO: Método para verificar que el CDN esté funcionando
  async testCdnConnection(): Promise<boolean> {
    try {
      // Intentar hacer un HEAD request al CDN
      const response = await axios.head(this.cdnUrl, { timeout: 5000 });
      console.log('✅ CDN connection test passed:', response.status);
      return true;
    } catch (error) {
      console.error('❌ CDN connection test failed:', error.message);
      return false;
    }
  }

  // Resto del código permanece igual...
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const filePath = this.extractPathFromUrl(fileUrl);
      console.log('🗑️ Deleting file:', filePath); // ← Debug log

      const response = await axios.delete(
        `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${filePath}`,
        {
          headers: {
            AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
          },
        },
      );

      const success = response.status === 200;
      console.log(success ? '✅ File deleted' : '❌ Delete failed:', filePath);
      return success;
    } catch (error) {
      console.error('❌ Error deleting file from Bunny.net:', error);
      return false;
    }
  }

  // Método privado para subir a Bunny.net Storage
  private async uploadToBunnyStorage(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const uploadUrl = `${this.storageApiUrl}/${process.env.BUNNY_STORAGE_ZONE}/${path}`;
    console.log('📤 Upload URL:', uploadUrl); // ← Debug log

    const response = await axios.put(uploadUrl, buffer, {
      headers: {
        AccessKey: process.env.BUNNY_STORAGE_PASSWORD,
        'Content-Type': mimeType,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.status !== 201) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    console.log('✅ Upload successful to storage'); // ← Debug log
  }

  // Resto de métodos permanecen iguales...
  private generateFileName(
    originalName: string,
    type: 'video' | 'document',
  ): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();

    return `${type}-${timestamp}-${randomString}.${extension}`;
  }

  private extractPathFromUrl(fileUrl: string): string {
    return fileUrl.replace(`${this.cdnUrl}/`, '');
  }

  isConfigured(): boolean {
    return !!(
      process.env.BUNNY_STORAGE_PASSWORD &&
      process.env.BUNNY_STORAGE_ZONE &&
      process.env.BUNNY_CDN_URL
    );
  }

  // Resto de métodos permanecen iguales...
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

  async validateFileExists(fileUrl: string): Promise<boolean> {
    const metadata = await this.getFileMetadata(fileUrl);
    return metadata.exists;
  }

  generateSecureDownloadUrl(
    fileUrl: string,
    expirationMinutes: number = 60,
  ): string {
    return fileUrl;
  }

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