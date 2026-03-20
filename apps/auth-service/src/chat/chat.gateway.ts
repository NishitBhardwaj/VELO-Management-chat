import { forwardRef, Inject } from '@nestjs/common';
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
import { CommandParserService } from './command-parser.service';
import { GroupRole } from '../groups/entities/group-member.entity';

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
        private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
        @Inject(forwardRef(() => GroupsService))
        private readonly groupsService: GroupsService,
        private readonly commandParserService: CommandParserService,
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

        // Run Command Parser
        const commands = this.commandParserService.extractCommands(data.text);
        if (commands.length > 0) {
            const result = await this.groupsService.processAttendanceCommands(data.groupId, senderId, commands);
            
            if (result.error) {
                client.emit('error_message', { message: result.error });
            } else if (result.updates && result.updates.length > 0) {
                for (const update of result.updates) {
                    // System Broadcast
                    const sysText = `Attendance Update: @${update.user.username} marked as ${update.status} by @${result.actor.username}`;
                    const sysMsg = await this.chatService.saveMessage(chatId, null, null, sysText);
                    const sysPayload = {
                        id: sysMsg.id, chat_id: chatId, sender_id: null, group_id: result.group.id, text: sysMsg.text, created_at: sysMsg.created_at.toISOString()
                    };
                    this.server.to(`group:${result.group.id}`).emit('new_group_message', sysPayload);
                    
                    // Direct Message to Target Username
                    const targetDmId = this.chatService.generateChatId(null, update.user.id);
                    const dmText = `You have been marked as ${update.status} by @${result.actor.username} in ${result.group.name}`;
                    const targetDmMsg = await this.chatService.saveMessage(targetDmId, null, update.user.id, dmText);
                    const targetSocket = this.connectedUsers.get(update.user.id);
                    if (targetSocket) {
                        targetSocket.emit('new_message', { ...targetDmMsg, created_at: targetDmMsg.created_at.toISOString() });
                    }
                    
                    // Direct Message to Group Owner
                    const ownerMembership = await this.groupsService.getGroupOwner(result.group.id);
                    if (ownerMembership) {
                        const ownerDmId = this.chatService.generateChatId(null, ownerMembership.user_id);
                        const ownerText = `Attendance Log: @${update.user.username} → ${update.status} (Marked by @${result.actor.username})`;
                        const ownerDmMsg = await this.chatService.saveMessage(ownerDmId, null, ownerMembership.user_id, ownerText);
                        const ownerSocket = this.connectedUsers.get(ownerMembership.user_id);
                        if (ownerSocket) {
                            ownerSocket.emit('new_message', { ...ownerDmMsg, created_at: ownerDmMsg.created_at.toISOString() });
                        }
                    }
                }
                
                this.server.emit('dashboard_updated', { groupId: data.groupId });
            }
        }

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

    // ─── Delete Message ─────────────────────────────

    @SubscribeMessage('delete_message')
    async handleDeleteMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { messageId: string },
    ) {
        const userId = (client as any).userId;
        if (!userId || !data.messageId) return;

        const msg = await this.chatService.getMessage(data.messageId);
        if (!msg) return;

        let canDelete = false;
        if (msg.sender_id === userId) {
            canDelete = true;
        } else if (msg.chat_id.startsWith('group:')) {
            const groupId = msg.chat_id.replace('group:', '');
            canDelete = await this.groupsService.isAdmin(groupId, userId);
        }

        if (canDelete) {
            await this.chatService.deleteMessage(data.messageId);
            const emitData = { messageId: data.messageId, chatId: msg.chat_id };
            
            if (msg.chat_id.startsWith('group:')) {
                const groupId = msg.chat_id.replace('group:', '');
                this.server.to(`group:${groupId}`).emit('message_deleted', emitData);
            } else {
                client.emit('message_deleted', emitData);
                if (msg.recipient_id) {
                    const recipientSocket = this.connectedUsers.get(msg.recipient_id);
                    if (recipientSocket) {
                        recipientSocket.emit('message_deleted', emitData);
                    }
                }
            }
        } else {
            client.emit('error_message', { message: 'You do not have permission to delete this message' });
        }
    }
}
