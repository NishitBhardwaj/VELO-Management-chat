import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';

export interface ProcessingResult {
    compressedKey: string;
    thumbnailKey: string;
    compressedSize: number;
    width: number;
    height: number;
}

@Injectable()
export class ImageProcessor {
    private readonly logger = new Logger(ImageProcessor.name);

    constructor(private readonly storage: StorageService) { }

    async processImage(originalKey: string): Promise<ProcessingResult> {
        this.logger.log(`Processing image: ${originalKey}`);

        // Download original
        const original = await this.storage.downloadBuffer(originalKey);

        // Get metadata
        const metadata = await sharp(original).metadata();

        // ─── Compress (quality 80%, max 2048px wide) ─────────
        const compressed = await sharp(original)
            .resize({ width: 2048, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        const compressedKey = originalKey.replace('originals/', 'compressed/');
        await this.storage.uploadBuffer(compressedKey, compressed, 'image/jpeg');

        // ─── Thumbnail (200x200) ─────────────────────────────
        const thumbnail = await sharp(original)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 60 })
            .toBuffer();

        const thumbnailKey = originalKey.replace('originals/', 'thumbnails/');
        await this.storage.uploadBuffer(thumbnailKey, thumbnail, 'image/jpeg');

        this.logger.log(
            `Processed: ${original.length}B → ${compressed.length}B, thumb: ${thumbnail.length}B`,
        );

        return {
            compressedKey,
            thumbnailKey,
            compressedSize: compressed.length,
            width: metadata.width || 0,
            height: metadata.height || 0,
        };
    }
}
