import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DirectMessage } from './direct-message.entity';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(DirectMessage)
        private messageRepo: Repository<DirectMessage>,
    ) {}

    /**
     * Generate a deterministic chat_id for a 1:1 DM.
     * Both users always produce the same chat_id regardless of who initiates.
     */
    generateChatId(userA: string, userB: string): string {
        const sorted = [userA, userB].sort();
        return `dm:${sorted[0]}:${sorted[1]}`;
    }

    /**
     * Save a message to PostgreSQL.
     */
    async saveMessage(
        chatId: string,
        senderId: string,
        recipientId: string | null,
        text: string,
        options?: {
            mediaUrl?: string;
            mediaType?: string;
            mediaName?: string;
            replyToId?: string;
        }
    ): Promise<DirectMessage> {
        const msg = this.messageRepo.create({
            chat_id: chatId,
            sender_id: senderId,
            recipient_id: recipientId,
            text,
            media_url: options?.mediaUrl,
            media_type: options?.mediaType,
            media_name: options?.mediaName,
            reply_to_id: options?.replyToId,
        });
        return this.messageRepo.save(msg);
    }

    /**
     * Load chat history with cursor-based pagination.
     * Returns messages ordered by created_at DESC (newest first).
     */
    async getHistory(
        chatId: string,
        limit: number = 30,
        beforeDate?: string,
    ): Promise<DirectMessage[]> {
        const where: any = { chat_id: chatId };
        if (beforeDate) {
            where.created_at = LessThan(new Date(beforeDate));
        }

        return this.messageRepo.find({
            where,
            order: { created_at: 'ASC' },
            take: limit,
        });
    }

    async getMessage(messageId: string): Promise<DirectMessage | null> {
        return this.messageRepo.findOne({ where: { id: messageId } });
    }

    async deleteMessage(messageId: string): Promise<void> {
        await this.messageRepo.delete({ id: messageId });
    }

    /**
     * Toggles an emoji reaction from a specific user on a message natively relying on the JSONB field.
     */
    async toggleReaction(messageId: string, userId: string, emoji: string): Promise<DirectMessage | null> {
        const msg = await this.messageRepo.findOne({ where: { id: messageId } });
        if (!msg) return null;

        const reactions = msg.reactions || {};
        const reactors = reactions[emoji] || [];

        const hasReacted = reactors.includes(userId);

        if (hasReacted) {
            // Remove user
            reactions[emoji] = reactors.filter(id => id !== userId);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        } else {
            // Add user
            reactions[emoji] = [...reactors, userId];
        }

        msg.reactions = reactions;
        return this.messageRepo.save(msg);
    }
}
