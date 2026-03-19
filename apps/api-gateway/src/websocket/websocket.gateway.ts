import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/chat'
})
export class ChatWebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('WebsocketGateway');
    private redisPub: Redis;
    private redisSub: Redis;

    // Mapping socketId -> userId
    private activeConnections = new Map<string, any>();

    constructor() {
        this.redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

        // Subscribe to messages from the Chat Service router
        this.redisSub.subscribe('gateway.messages', (err) => {
            if (err) this.logger.error('Failed to subscribe to Redis', err);
        });

        this.redisSub.on('message', (channel, message) => {
            if (channel === 'gateway.messages') {
                const payload = JSON.parse(message);
                // Payload expects { to: socketId or 'broadcast-room', event: 'chat_msg', data: ... }
                if (payload.to_room) {
                    this.server.to(payload.to_room).emit(payload.event, payload.data);
                } else if (payload.to_user_id) {
                    // Send to specific user room
                    this.server.to(`user:${payload.to_user_id}`).emit(payload.event, payload.data);
                }
            }
        });
    }

    handleConnection(client: Socket) {
        const token = client.handshake.auth?.token || client.handshake.query?.token;
        if (!token) {
            client.disconnect();
            return;
        }

        try {
            const secret = process.env.JWT_SECRET || 'velo_super_secret_dev_key';
            const decoded: any = jwt.verify(token as string, secret);

            this.activeConnections.set(client.id, decoded);
            client.join(`user:${decoded.id}`); // Join personal room for DMs

            // Mark presence online in Redis
            this.redisPub.setex(`online:${decoded.id}`, 65, 'true'); // 65s TTL

            this.logger.log(`Client Connected: ${decoded.phone} (${client.id})`);
        } catch (err) {
            this.logger.error('Socket authentication failed', err.message);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const user = this.activeConnections.get(client.id);
        if (user) {
            this.activeConnections.delete(client.id);
            this.redisPub.del(`online:${user.id}`);
            this.redisPub.set(`last_seen:${user.id}`, new Date().toISOString());
            this.logger.log(`Client Disconnected: ${user.phone}`);
        }
    }

    @SubscribeMessage('heartbeat')
    handleHeartbeat(@ConnectedSocket() client: Socket) {
        const user = this.activeConnections.get(client.id);
        if (user) {
            // Refresh TTL
            this.redisPub.setex(`online:${user.id}`, 65, 'true');
        }
        return { status: 'alive' };
    }

    @SubscribeMessage('send_message')
    async handleIncomingMessage(
        @MessageBody() data: any,
        @ConnectedSocket() client: Socket
    ) {
        const user = this.activeConnections.get(client.id);
        if (!user) return;

        // Push the raw message to Kafka or Redis Queue for the `chat-service` to process securely
        // But since the chat-service isn't built yet, we'll just publish to a stub topic
        await this.redisPub.publish('chat.inbound', JSON.stringify({
            sender_id: user.id,
            ...data
        }));

        return { delivered_to_gateway: true };
    }
}
