import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private client: Minio.Client;
    private readonly bucketName = process.env.MINIO_BUCKET || 'velo-media';

    async onModuleInit() {
        this.client = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY || 'velo_minio',
            secretKey: process.env.MINIO_SECRET_KEY || 'velo_minio_2026',
        });

        // Ensure bucket exists
        const exists = await this.client.bucketExists(this.bucketName);
        if (!exists) {
            await this.client.makeBucket(this.bucketName);
            this.logger.log(`Created bucket: ${this.bucketName}`);
        }
        this.logger.log(`MinIO connected → bucket: ${this.bucketName}`);
    }

    // ─── Pre-signed Upload URL ─────────────────────────────
    async getPresignedUploadUrl(
        key: string,
        expirySeconds = 300, // 5 minutes
    ): Promise<string> {
        return this.client.presignedPutObject(this.bucketName, key, expirySeconds);
    }

    // ─── Pre-signed Download URL ───────────────────────────
    async getPresignedDownloadUrl(
        key: string,
        expirySeconds = 3600, // 1 hour
    ): Promise<string> {
        return this.client.presignedGetObject(this.bucketName, key, expirySeconds);
    }

    // ─── Direct Upload (from buffer) ──────────────────────
    async uploadBuffer(
        key: string,
        buffer: Buffer,
        contentType: string,
    ): Promise<void> {
        await this.client.putObject(this.bucketName, key, buffer, buffer.length, {
            'Content-Type': contentType,
        });
    }

    // ─── Download as Buffer ────────────────────────────────
    async downloadBuffer(key: string): Promise<Buffer> {
        const stream = await this.client.getObject(this.bucketName, key);
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    // ─── Delete File ───────────────────────────────────────
    async deleteFile(key: string): Promise<void> {
        await this.client.removeObject(this.bucketName, key);
    }

    // ─── Get File Info ─────────────────────────────────────
    async getFileInfo(key: string): Promise<Minio.BucketItemStat> {
        return this.client.statObject(this.bucketName, key);
    }

    // ─── Build CDN/public URL ──────────────────────────────
    getPublicUrl(key: string): string {
        const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
        const port = process.env.MINIO_PORT || '9000';
        return `http://${endpoint}:${port}/${this.bucketName}/${key}`;
    }
}
