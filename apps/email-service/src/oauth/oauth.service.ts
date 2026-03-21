import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { EmailConnection, EmailAuditLog } from '../entities';
import * as CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'velo-token-key-change-in-production';

@Injectable()
export class OAuthService {
    private readonly logger = new Logger(OAuthService.name);

    constructor(
        @InjectRepository(EmailConnection)
        private readonly connRepo: Repository<EmailConnection>,
        @InjectRepository(EmailAuditLog)
        private readonly auditRepo: Repository<EmailAuditLog>,
    ) { }

    // ─── Create OAuth2 Client ──────────────────────────────

    private createOAuth2Client() {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID || 'your-client-id',
            process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3004/oauth/callback',
        );
    }

    // ─── Get OAuth URL ─────────────────────────────────────

    getAuthUrl(userId: string): string {
        const oauth2Client = this.createOAuth2Client();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            state: userId,
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
        });
    }

    // ─── Exchange Auth Code for Tokens ─────────────────────

    async exchangeCode(
        code: string,
        userId: string,
    ): Promise<EmailConnection> {
        const oauth2Client = this.createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Get Gmail address
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const gmailAddress = userInfo.data.email || 'unknown';

        // Encrypt refresh token (AES-256)
        const encryptedToken = CryptoJS.AES.encrypt(
            tokens.refresh_token || '',
            ENCRYPTION_KEY,
        ).toString();

        // Store connection
        let connection = await this.connRepo.findOne({ where: { user_id: userId } });
        if (connection) {
            connection.gmail_address = gmailAddress;
            connection.vault_token_key = encryptedToken;
            connection.sync_status = 'active';
        } else {
            connection = this.connRepo.create({
                user_id: userId,
                gmail_address: gmailAddress,
                vault_token_key: encryptedToken,
                sync_status: 'active',
            });
        }
        const saved = await this.connRepo.save(connection);

        // Audit
        await this.auditRepo.save(
            this.auditRepo.create({
                user_id: userId,
                action: 'connect',
            }),
        );

        this.logger.log(`Gmail connected: ${gmailAddress} for user ${userId}`);
        return saved;
    }

    // ─── Get Authenticated Gmail Client ────────────────────

    async getGmailClient(userId: string) {
        const connection = await this.connRepo.findOne({
            where: { user_id: userId, sync_status: 'active' },
        });
        if (!connection) return null;

        // Decrypt refresh token
        const decrypted = CryptoJS.AES.decrypt(
            connection.vault_token_key,
            ENCRYPTION_KEY,
        ).toString(CryptoJS.enc.Utf8);

        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: decrypted });

        return {
            gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
            connection,
        };
    }

    // ─── Disconnect Gmail ──────────────────────────────────

    async disconnect(userId: string): Promise<void> {
        await this.connRepo.update(
            { user_id: userId },
            { sync_status: 'disconnected' },
        );

        await this.auditRepo.save(
            this.auditRepo.create({
                user_id: userId,
                action: 'disconnect',
            }),
        );
        this.logger.log(`Gmail disconnected for user ${userId}`);
    }

    // ─── Get Connection Status ─────────────────────────────

    async getConnectionStatus(userId: string) {
        const conn = await this.connRepo.findOne({ where: { user_id: userId } });
        if (!conn) return { connected: false };
        return {
            connected: conn.sync_status === 'active',
            gmail_address: conn.gmail_address,
            sync_status: conn.sync_status,
            connected_at: conn.connected_at,
        };
    }
}
