import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { GroupsService } from '../groups/groups.service';

@WebSocketGateway({
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true,
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Track connected users: userId → socket
    private connectedUsers = new Map<string, Socket>();

    constructor(
        private jwtService: JwtService,
        private chatService: ChatService,
        private groupsService: GroupsService,
    ) {}

    /**
     * On connect: validate JWT, register user, and auto-join group rooms.
     */
    async handleConnection(client: Socket) {
        try {
            const token =
                client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token) {
                console.log('❌ WS: No token provided, disconnecting');
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload.sub || payload.id;

            if (!userId) {
                client.disconnect();
                return;
            }

            // Attach userId to the socket
            (client as any).userId = userId;
            this.connectedUsers.set(userId, client);

            console.log(`✅ WS: User ${userId} connected (socket: ${client.id})`);

            // Auto-join group rooms
            try {
                const groupIds = await this.groupsService.getUserGroupIds(userId);
                for (const gid of groupIds) {
                    client.join(`group:${gid}`);
                }
                if (groupIds.length > 0) {
                    console.log(`  📦 Joined ${groupIds.length} group room(s)`);
                }
            } catch (e) {
                console.log('  ⚠️ Could not join group rooms:', e.message);
            }

            client.emit('authenticated', { userId });
        } catch (err) {
            console.log('❌ WS: Invalid token, disconnecting', err.message);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = (client as any).userId;
        if (userId) {
            this.connectedUsers.delete(userId);
            console.log(`🔌 WS: User ${userId} disconnected`);
        }
    }

    // ─── DM: Send direct message ───────────────────

    @SubscribeMessage('send_message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { recipientId: string; text: string },
    ) {
        const senderId = (client as any).userId;
        if (!senderId || !data.recipientId || !data.text?.trim()) return;

        const chatId = this.chatService.generateChatId(senderId, data.recipientId);
        const savedMsg = await this.chatService.saveMessage(
            chatId, senderId, data.recipientId, data.text.trim(),
        );

        const messagePayload = {
            id: savedMsg.id,
            chat_id: chatId,
            sender_id: senderId,
            recipient_id: data.recipientId,
            text: savedMsg.text,
            created_at: savedMsg.created_at.toISOString(),
        };

        const recipientSocket = this.connectedUsers.get(data.recipientId);
        if (recipientSocket) {
            recipientSocket.emit('new_message', messagePayload);
        }

        client.emit('message_sent', messagePayload);
        return messagePayload;
    }

    // ─── Group: Send group message ─────────────────

    @SubscribeMessage('send_group_message')
    async handleGroupMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { groupId: string; text: string },
    ) {
        const senderId = (client as any).userId;
        if (!senderId || !data.groupId || !data.text?.trim()) return;

        // Check permission
        const canSend = await this.groupsService.canSendMessage(data.groupId, senderId);
        if (!canSend) {
            client.emit('error_message', {
                message: 'You do not have permission to send messages in this group',
            });
            return;
        }

        const chatId = `group:${data.groupId}`;
        const savedMsg = await this.chatService.saveMessage(
            chatId, senderId, null, data.text.trim(),
        );

        const messagePayload = {
            id: savedMsg.id,
            chat_id: chatId,
            sender_id: senderId,
            group_id: data.groupId,
            text: savedMsg.text,
            created_at: savedMsg.created_at.toISOString(),
        };

        // Broadcast to all users in the group room (except sender)
        client.to(`group:${data.groupId}`).emit('new_group_message', messagePayload);

        // Send confirmation back to sender
        client.emit('group_message_sent', messagePayload);

        return messagePayload;
    }

    // ─── Typing indicators ─────────────────────────

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { recipientId: string; isTyping: boolean },
    ) {
        const senderId = (client as any).userId;
        const recipientSocket = this.connectedUsers.get(data.recipientId);
        if (recipientSocket) {
            recipientSocket.emit('user_typing', {
                userId: senderId,
                isTyping: data.isTyping,
            });
        }
    }
}
