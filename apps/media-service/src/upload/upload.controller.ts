import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { ImageProcessor } from '../processing/image.processor';
import { v4 as uuid } from 'uuid';

// ─── DTOs ────────────────────────────────────────────────

class RequestUploadDto {
    filename: string;
    mime_type: string;
    size: number;
    media_type: string; // image | video | voice_note | document
}

// ─── Size Limits ─────────────────────────────────────────

const SIZE_LIMITS: Record<string, number> = {
    image: 20 * 1024 * 1024,        // 20MB
    video: 500 * 1024 * 1024,       // 500MB
    voice_note: 50 * 1024 * 1024,   // 50MB
    document: 100 * 1024 * 1024,    // 100MB
};

const ALLOWED_MIMES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
    voice_note: ['audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/webm'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

@Controller('media')
export class UploadController {
    constructor(
        private readonly storage: StorageService,
        private readonly imageProcessor: ImageProcessor,
    ) { }

    // ─── GET /media/health ─────────────────────────────────
    @Get('health')
    health() {
        return { status: 'ok', service: 'media-service', timestamp: new Date().toISOString() };
    }

    // ─── POST /media/upload-url ────────────────────────────
    // Client requests a pre-signed URL, then uploads directly to MinIO
    @Post('upload-url')
    async getUploadUrl(@Body() dto: RequestUploadDto) {
        const { filename, mime_type, size, media_type } = dto;

        // Validate media type
        if (!SIZE_LIMITS[media_type]) {
            throw new BadRequestException(`Invalid media_type: ${media_type}`);
        }

        // Validate size
        if (size > SIZE_LIMITS[media_type]) {
            throw new BadRequestException(
                `File too large. Max ${SIZE_LIMITS[media_type] / (1024 * 1024)}MB for ${media_type}`,
            );
        }

        // Validate mime type
        if (!ALLOWED_MIMES[media_type]?.includes(mime_type)) {
            throw new BadRequestException(`Invalid mime type: ${mime_type} for ${media_type}`);
        }

        // Generate unique S3 key
        const mediaId = uuid();
        const ext = filename.split('.').pop() || 'bin';
        const s3Key = `originals/${media_type}/${mediaId}.${ext}`;

        // Generate pre-signed upload URL (5 min expiry)
        const uploadUrl = await this.storage.getPresignedUploadUrl(s3Key, 300);

        return {
            media_id: mediaId,
            upload_url: uploadUrl,
            s3_key: s3Key,
            expires_in: 300,
        };
    }

    // ─── POST /media/upload-complete ───────────────────────
    // Client notifies server that upload is complete → triggers processing
    @Post('upload-complete')
    async uploadComplete(
        @Body() body: { media_id: string; s3_key: string; media_type: string },
    ) {
        const { media_id, s3_key, media_type } = body;

        let result: any = { media_id, s3_key, status: 'stored' };

        // Process images automatically
        if (media_type === 'image') {
            const processed = await this.imageProcessor.processImage(s3_key);
            result = {
                ...result,
                status: 'processed',
                compressed_url: this.storage.getPublicUrl(processed.compressedKey),
                thumbnail_url: this.storage.getPublicUrl(processed.thumbnailKey),
                compressed_size: processed.compressedSize,
                width: processed.width,
                height: processed.height,
            };
        }

        // Videos/voice_notes/docs: store as-is for now (FFmpeg later)
        const downloadUrl = await this.storage.getPresignedDownloadUrl(s3_key);
        result.download_url = downloadUrl;

        return result;
    }

    // ─── POST /media/upload-direct ─────────────────────────
    // Direct upload via multipart form (for smaller files / simpler clients)
    @Post('upload-direct')
    @UseInterceptors(FileInterceptor('file'))
    async uploadDirect(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { media_type: string },
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        const mediaType = body.media_type || 'document';
        const mediaId = uuid();
        const ext = file.originalname.split('.').pop() || 'bin';
        const s3Key = `originals/${mediaType}/${mediaId}.${ext}`;

        // Upload to MinIO
        await this.storage.uploadBuffer(s3Key, file.buffer, file.mimetype);

        let result: any = {
            media_id: mediaId,
            s3_key: s3Key,
            original_name: file.originalname,
            size: file.size,
            mime_type: file.mimetype,
            status: 'stored',
        };

        // Auto-process images
        if (mediaType === 'image') {
            const processed = await this.imageProcessor.processImage(s3Key);
            result = {
                ...result,
                status: 'processed',
                compressed_url: this.storage.getPublicUrl(processed.compressedKey),
                thumbnail_url: this.storage.getPublicUrl(processed.thumbnailKey),
                width: processed.width,
                height: processed.height,
            };
        }

        const downloadUrl = await this.storage.getPresignedDownloadUrl(s3Key);
        result.download_url = downloadUrl;

        return result;
    }

    // ─── GET /media/download/:key ──────────────────────────
    @Get('download/*')
    async getDownloadUrl(@Param() params: any) {
        const key = params[0] || params['0'];
        const url = await this.storage.getPresignedDownloadUrl(key);
        return { download_url: url };
    }
}
