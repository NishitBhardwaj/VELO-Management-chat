import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Redirect,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { OAuthService } from '../oauth/oauth.service';
import { EmailService } from './email.service';
import { EmailClassifier } from './email-classifier.service';

@Controller()
export class EmailController {
    constructor(
        private readonly oauthService: OAuthService,
        private readonly emailService: EmailService,
        private readonly classifier: EmailClassifier,
    ) { }

    // ─── Health ────────────────────────────────────────────
    @Get('health')
    health() {
        return { status: 'ok', service: 'email-service', timestamp: new Date().toISOString() };
    }

    // ═══════════════════════════════════════════════════════
    // OAuth Endpoints
    // ═══════════════════════════════════════════════════════

    // ─── GET /oauth/connect → Redirect to Google ──────────
    @Get('oauth/connect')
    @Redirect()
    connect() {
        const url = this.oauthService.getAuthUrl();
        return { url };
    }

    // ─── GET /oauth/callback → Exchange code ──────────────
    @Get('oauth/callback')
    async callback(@Query('code') code: string, @Query('state') userId: string) {
        if (!code) return { error: 'No authorization code provided' };
        // In production, userId comes from JWT. For dev, pass as state parameter.
        const uid = userId || 'dev-user';
        const connection = await this.oauthService.exchangeCode(code, uid);
        return {
            success: true,
            gmail_address: connection.gmail_address,
            message: 'Gmail connected successfully! ✅',
        };
    }

    // ─── POST /oauth/disconnect ───────────────────────────
    @Post('oauth/disconnect')
    @HttpCode(HttpStatus.OK)
    async disconnect(@Body() body: { user_id: string }) {
        await this.oauthService.disconnect(body.user_id);
        return { success: true, message: 'Gmail disconnected' };
    }

    // ─── GET /oauth/status/:userId ────────────────────────
    @Get('oauth/status/:userId')
    async connectionStatus(@Param('userId') userId: string) {
        return this.oauthService.getConnectionStatus(userId);
    }

    // ═══════════════════════════════════════════════════════
    // Email Endpoints
    // ═══════════════════════════════════════════════════════

    // ─── POST /email/fetch ────────────────────────────────
    @Post('email/fetch')
    @HttpCode(HttpStatus.OK)
    async fetchEmails(@Body() body: { user_id: string; max_results?: number }) {
        const emails = await this.emailService.fetchEmails(
            body.user_id,
            body.max_results || 20,
        );
        return { count: emails.length, emails };
    }

    // ─── GET /email/inbox/:userId ─────────────────────────
    @Get('email/inbox/:userId')
    async getInbox(
        @Param('userId') userId: string,
        @Query('category') category?: string,
        @Query('limit') limit?: string,
    ) {
        const emails = await this.emailService.getStoredEmails(
            userId,
            category,
            parseInt(limit || '50'),
        );
        return { count: emails.length, category: category || 'all', emails };
    }

    // ─── POST /email/reply ────────────────────────────────
    @Post('email/reply')
    @HttpCode(HttpStatus.OK)
    async reply(
        @Body()
        body: {
            user_id: string;
            thread_id: string;
            message_id: string;
            content: string;
        },
    ) {
        return this.emailService.replyToEmail(
            body.user_id,
            body.thread_id,
            body.message_id,
            body.content,
        );
    }

    // ─── POST /email/mark-read ────────────────────────────
    @Post('email/mark-read')
    @HttpCode(HttpStatus.OK)
    async markRead(@Body() body: { user_id: string; gmail_message_id: string }) {
        await this.emailService.markAsRead(body.user_id, body.gmail_message_id);
        return { success: true };
    }

    // ─── GET /email/audit/:userId ─────────────────────────
    @Get('email/audit/:userId')
    async getAuditLog(@Param('userId') userId: string) {
        const log = await this.emailService.getAuditLog(userId);
        return { count: log.length, log };
    }

    // ═══════════════════════════════════════════════════════
    // Classifier Test
    // ═══════════════════════════════════════════════════════

    // ─── POST /email/classify-test ────────────────────────
    @Post('email/classify-test')
    @HttpCode(HttpStatus.OK)
    classifyTest(@Body() body: { sender: string; subject: string }) {
        return this.classifier.classifyTest(body.sender, body.subject);
    }
}
