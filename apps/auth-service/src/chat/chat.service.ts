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
        recipientId: string,
        text: string,
    ): Promise<DirectMessage> {
        const msg = this.messageRepo.create({
            chat_id: chatId,
            sender_id: senderId,
            recipient_id: recipientId,
            text,
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
}
