import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailMetadata, EmailAuditLog } from '../entities';
import { OAuthService } from '../oauth/oauth.service';
import { EmailClassifier } from './email-classifier.service';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(
        @InjectRepository(EmailMetadata)
        private readonly metadataRepo: Repository<EmailMetadata>,
        @InjectRepository(EmailAuditLog)
        private readonly auditRepo: Repository<EmailAuditLog>,
        private readonly oauthService: OAuthService,
        private readonly classifier: EmailClassifier,
    ) { }

    // ─── Fetch Recent Emails ──────────────────────────────

    async fetchEmails(userId: string, maxResults = 20): Promise<EmailMetadata[]> {
        const client = await this.oauthService.getGmailClient(userId);
        if (!client) {
            throw new NotFoundException('Gmail not connected. Use /oauth/connect first.');
        }

        const { gmail, connection } = client;

        // Fetch message list
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults,
            labelIds: ['INBOX'],
        });

        const messages = response.data.messages || [];
        const results: EmailMetadata[] = [];

        for (const msg of messages.slice(0, maxResults)) {
            // Check if already stored
            const existing = await this.metadataRepo.findOne({
                where: { user_id: userId, gmail_message_id: msg.id! },
            });
            if (existing) {
                results.push(existing);
                continue;
            }

            // Fetch full message
            const full = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'Date'],
            });

            const headers = full.data.payload?.headers || [];
            const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
            const from = headers.find((h) => h.name === 'From')?.value || '';
            const dateStr = headers.find((h) => h.name === 'Date')?.value || '';

            // Parse sender
            const senderMatch = from.match(/^(.+?)\s*<(.+?)>$/);
            const senderName = senderMatch ? senderMatch[1].replace(/"/g, '').trim() : from;
            const senderAddress = senderMatch ? senderMatch[2] : from;

            // Classify
            const classification = this.classifier.classify(
                senderAddress,
                subject,
                full.data.snippet || '',
            );

            // Store metadata
            const metadata = this.metadataRepo.create({
                user_id: userId,
                gmail_message_id: msg.id!,
                gmail_thread_id: full.data.threadId!,
                subject,
                sender_address: senderAddress,
                sender_name: senderName,
                category: classification.category,
                has_attachments: (full.data.payload?.parts?.length || 0) > 1,
                attachment_count: Math.max(0, (full.data.payload?.parts?.length || 1) - 1),
                is_read: !(full.data.labelIds || []).includes('UNREAD'),
                snippet: full.data.snippet || '',
                received_at: dateStr ? new Date(dateStr) : new Date(),
            });

            const saved = await this.metadataRepo.save(metadata);
            results.push(saved);
        }

        this.logger.log(`Fetched ${results.length} emails for user ${userId}`);
        return results;
    }

    // ─── Reply to Email (Thread-Preserving) ────────────────

    async replyToEmail(
        userId: string,
        threadId: string,
        messageId: string,
        replyContent: string,
    ): Promise<{ success: boolean; messageId: string }> {
        const client = await this.oauthService.getGmailClient(userId);
        if (!client) {
            throw new NotFoundException('Gmail not connected');
        }

        // Get original email for headers
        const original = await client.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Message-ID'],
        });

        const headers = original.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const originalMessageId = headers.find((h) => h.name === 'Message-ID')?.value || '';

        // Build MIME message with thread-preserving headers
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        const mimeMessage = [
            `To: ${from}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${originalMessageId}`,
            `References: ${originalMessageId}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            replyContent,
        ].join('\r\n');

        // Base64url encode
        const encoded = Buffer.from(mimeMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Send via Gmail API
        const sent = await client.gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encoded,
                threadId: threadId,
            },
        });

        // Audit
        await this.auditRepo.save(
            this.auditRepo.create({
                user_id: userId,
                action: 'reply',
                gmail_thread_id: threadId,
                gmail_message_id: sent.data.id || '',
                recipient: from,
            }),
        );

        this.logger.log(`Reply sent in thread ${threadId}`);
        return { success: true, messageId: sent.data.id || '' };
    }

    // ─── Get Stored Emails ─────────────────────────────────

    async getStoredEmails(userId: string, category?: string, limit = 50): Promise<EmailMetadata[]> {
        const query = this.metadataRepo
            .createQueryBuilder('email')
            .where('email.user_id = :userId', { userId })
            .orderBy('email.received_at', 'DESC')
            .take(limit);

        if (category) {
            query.andWhere('email.category = :category', { category });
        }

        return query.getMany();
    }

    // ─── Mark as Read ──────────────────────────────────────

    async markAsRead(userId: string, gmailMessageId: string): Promise<void> {
        const client = await this.oauthService.getGmailClient(userId);
        if (!client) throw new NotFoundException('Gmail not connected');

        await client.gmail.users.messages.modify({
            userId: 'me',
            id: gmailMessageId,
            requestBody: { removeLabelIds: ['UNREAD'] },
        });

        await this.metadataRepo.update(
            { user_id: userId, gmail_message_id: gmailMessageId },
            { is_read: true },
        );

        await this.auditRepo.save(
            this.auditRepo.create({
                user_id: userId,
                action: 'read',
                gmail_message_id: gmailMessageId,
            }),
        );
    }

    // ─── Get Audit Log ─────────────────────────────────────

    async getAuditLog(userId: string, limit = 50): Promise<EmailAuditLog[]> {
        return this.auditRepo.find({
            where: { user_id: userId },
            order: { performed_at: 'DESC' },
            take: limit,
        });
    }
}
