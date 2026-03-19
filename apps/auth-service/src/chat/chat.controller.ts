import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private chatService: ChatService) {}

    /**
     * GET /chat/:contactId/messages?limit=30&before=2026-03-20T00:00:00Z
     * 
     * Loads message history for a 1:1 conversation.
     * The chatId is generated deterministically from the authenticated user + contactId.
     */
    @Get(':contactId/messages')
    async getMessages(
        @Request() req,
        @Param('contactId') contactId: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
    ) {
        const userId = req.user.id;
        const chatId = this.chatService.generateChatId(userId, contactId);
        const messages = await this.chatService.getHistory(
            chatId,
            limit ? parseInt(limit, 10) : 30,
            before,
        );

        return messages.map(msg => ({
            id: msg.id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            text: msg.text,
            created_at: msg.created_at.toISOString(),
        }));
    }
}
