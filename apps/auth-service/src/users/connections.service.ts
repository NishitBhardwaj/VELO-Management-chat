import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, ConnectionStatus } from './entities/connection.entity';
import { User } from './entities/user.entity';

@Injectable()
export class ConnectionsService {
    constructor(
        @InjectRepository(Connection)
        private connectionRepository: Repository<Connection>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async sendRequest(requesterId: string, recipientId: string): Promise<Connection> {
        if (requesterId === recipientId) {
            throw new ConflictException('Cannot send connection request to yourself');
        }

        const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
        if (!recipient) {
            throw new NotFoundException('Recipient not found');
        }

        const existing = await this.connectionRepository.findOne({
            where: [
                { requester_id: requesterId, recipient_id: recipientId },
                { requester_id: recipientId, recipient_id: requesterId },
            ]
        });

        if (existing) {
            throw new ConflictException('Connection or pending request already exists between these users');
        }

        const conn = this.connectionRepository.create({
            requester_id: requesterId,
            recipient_id: recipientId,
            status: ConnectionStatus.PENDING,
        });

        return this.connectionRepository.save(conn);
    }

    async getPendingRequests(userId: string): Promise<Connection[]> {
        return this.connectionRepository.find({
            where: { recipient_id: userId, status: ConnectionStatus.PENDING },
            relations: ['requester'],
            order: { created_at: 'DESC' }
        });
    }

    async getAcceptedContacts(userId: string): Promise<User[]> {
        const connections = await this.connectionRepository.find({
            where: [
                { requester_id: userId, status: ConnectionStatus.ACCEPTED },
                { recipient_id: userId, status: ConnectionStatus.ACCEPTED },
            ],
            relations: ['requester', 'recipient']
        });

        return connections.map(conn => 
            conn.requester_id === userId ? conn.recipient : conn.requester
        );
    }

    async respondToRequest(userId: string, connectionId: string, status: ConnectionStatus.ACCEPTED | ConnectionStatus.REJECTED): Promise<Connection> {
        const conn = await this.connectionRepository.findOne({ where: { id: connectionId } });
        
        if (!conn) {
            throw new NotFoundException('Connection request not found');
        }

        if (conn.recipient_id !== userId) {
            throw new ConflictException('Not authorized to respond to this request');
        }

        if (conn.status !== ConnectionStatus.PENDING) {
            throw new ConflictException('Request is already processed');
        }

        conn.status = status;
        return this.connectionRepository.save(conn);
    }
}
