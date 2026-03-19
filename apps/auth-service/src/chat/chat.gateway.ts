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
    ) {}

    /**
     * On WebSocket connect: validate JWT and register the user.
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

            // Attach userId to the socket for later use
            (client as any).userId = userId;
            this.connectedUsers.set(userId, client);

            console.log(`✅ WS: User ${userId} connected (socket: ${client.id})`);

            // Notify the client they are authenticated
            client.emit('authenticated', { userId });
        } catch (err) {
            console.log('❌ WS: Invalid token, disconnecting', err.message);
            client.disconnect();
        }
    }

    /**
     * On WebSocket disconnect: remove from connected users map.
     */
    handleDisconnect(client: Socket) {
        const userId = (client as any).userId;
        if (userId) {
            this.connectedUsers.delete(userId);
            console.log(`🔌 WS: User ${userId} disconnected`);
        }
    }

    /**
     * Handle incoming message from client.
     * 1. Generate deterministic chat_id
     * 2. Persist to PostgreSQL
     * 3. Send to recipient in real-time (if online)
     * 4. Send confirmation back to sender
     */
    @SubscribeMessage('send_message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { recipientId: string; text: string },
    ) {
        const senderId = (client as any).userId;
        if (!senderId || !data.recipientId || !data.text?.trim()) {
            return;
        }

        // 1. Generate deterministic chat_id
        const chatId = this.chatService.generateChatId(senderId, data.recipientId);

        // 2. Persist to database
        const savedMsg = await this.chatService.saveMessage(
            chatId,
            senderId,
            data.recipientId,
            data.text.trim(),
        );

        const messagePayload = {
            id: savedMsg.id,
            chat_id: chatId,
            sender_id: senderId,
            recipient_id: data.recipientId,
            text: savedMsg.text,
            created_at: savedMsg.created_at.toISOString(),
        };

        // 3. Send to recipient if they are online
        const recipientSocket = this.connectedUsers.get(data.recipientId);
        if (recipientSocket) {
            recipientSocket.emit('new_message', messagePayload);
        }

        // 4. Send confirmation back to sender
        client.emit('message_sent', messagePayload);

        return messagePayload;
    }

    /**
     * Handle typing indicator (ephemeral, not persisted).
     */
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
