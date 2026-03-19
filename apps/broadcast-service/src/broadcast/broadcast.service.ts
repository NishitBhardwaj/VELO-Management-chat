import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { BroadcastMessage, BroadcastAuditLog } from '../entities';
import { CommandParserService, ParsedBroadcastCommand } from './command-parser.service';
import { Kafka } from 'kafkajs';

@Injectable()
export class BroadcastService {
    private readonly logger = new Logger(BroadcastService.name);
    private kafka: Kafka;
    private producer: any;

    constructor(
        @InjectRepository(BroadcastMessage)
        private readonly broadcastRepo: Repository<BroadcastMessage>,
        @InjectRepository(BroadcastAuditLog)
        private readonly auditRepo: Repository<BroadcastAuditLog>,
        private readonly parser: CommandParserService,
    ) {
        this.kafka = new Kafka({
            clientId: 'broadcast-service',
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        });
        this.producer = this.kafka.producer();
        this.connectKafka();
    }

    private async connectKafka() {
        try {
            await this.producer.connect();
            this.logger.log('Kafka Producer connected successfully (broadcast.events)');
        } catch (err) {
            this.logger.error('Failed to connect Kafka Producer', err);
        }
    }

    /**
     * Main entry point to handle a chat command for broadcasting.
     */
    async executeBroadcastCommand(cmdString: string, senderId: string, senderRole: string) {
        // 1. RBAC
        if (!['hr', 'manager', 'admin'].includes(senderRole)) {
            throw new ForbiddenException('Only HR, Managers, or Admins can issue broadcasts.');
        }

        // 2. Parse
        const parsed = this.parser.parse(cmdString);
        if (!parsed) {
            return { handled: false, reason: 'Not a broadcast command' };
        }

        // 3. Rate Limiting Check
        if (!parsed.isEmergency) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentBroadcasts = await this.broadcastRepo.count({
                where: { sender_id: senderId, created_at: MoreThan(oneHourAgo) },
            });
            if (recentBroadcasts >= 10) {
                throw new BadRequestException('Rate limit exceeded: Max 10 broadcasts per hour. Use --emergency if critical.');
            }
        }

        // 4. Create Broadcast Entity (Master Record)
        const broadcast = this.broadcastRepo.create({
            sender_id: senderId,
            target_type: parsed.action,
            target_value: parsed.targetValue,
            priority: parsed.priority,
            message: parsed.message,
            requires_ack: parsed.requiresAck,
            scheduled_at: parsed.scheduledAt,
            is_recurring: !!parsed.recurrenceRule,
            recurrence_rule: parsed.recurrenceRule,
            status: parsed.scheduledAt ? 'scheduled' : 'sending',
            started_at: parsed.scheduledAt ? undefined : new Date(),
        });

        const saved = await this.broadcastRepo.save(broadcast);

        // 5. Audit Log
        await this.auditRepo.save(
            this.auditRepo.create({
                broadcast_id: saved.id,
                actor_id: senderId,
                action: 'created',
                details: { target: parsed.action, value: parsed.targetValue, priority: parsed.priority },
            })
        );

        // 6. Fan-out Emit to Kafka `broadcast.events` (ONLY if not scheduled for later)
        if (!parsed.scheduledAt) {
            await this.producer.send({
                topic: 'broadcast.events',
                messages: [
                    {
                        key: saved.id,
                        value: JSON.stringify({
                            broadcast_id: saved.id,
                            target_type: saved.target_type,
                            target_value: saved.target_value,
                            message: saved.message,
                            priority: saved.priority,
                        }),
                    },
                ],
            });
        }

        this.logger.log(`Broadcast [${saved.id}] created. TARGET: ${parsed.action} ${parsed.targetValue || ''}`);

        return {
            handled: true,
            broadcast_id: saved.id,
            target: parsed.action,
            priority: parsed.priority,
            status: parsed.scheduledAt ? 'scheduled' : 'sending_to_workers',
            message: parsed.scheduledAt ? 'Broadcast scheduled successfully.' : `Broadcast queued for delivery (Priority: ${parsed.priority}). Tracking ID: ${saved.id.split('-')[0]}`,
        };
    }

    /**
   * Query status / analytical stats for a specific broadcast.
   */
    async getBroadcastStats(broadcastId: string) {
        const bc = await this.broadcastRepo.findOne({ where: { id: broadcastId } });
        if (!bc) throw new BadRequestException('Broadcast not found');
        return bc;
    }

    /**
     * Acknowledge a broadcast.
     */
    async acknowledgeBroadcast(userId: string, broadcastId: string) {
        const bc = await this.broadcastRepo.findOne({ where: { id: broadcastId } });
        if (!bc) throw new BadRequestException('Broadcast not found');
        if (!bc.requires_ack) throw new BadRequestException('This broadcast does not require acknowledgment');

        // we should update delivery log as well, but for simplicity we increment the master stats
        bc.ack_count += 1;
        await this.broadcastRepo.save(bc);

        await this.auditRepo.save(
            this.auditRepo.create({
                broadcast_id: broadcastId,
                actor_id: userId,
                action: 'acknowledged',
            })
        );

        return { success: true, message: 'Broadcast acknowledged' };
    }

    /**
     * Export analytical data for a broadcast.
     */
    async exportBroadcastAnalytics(broadcastId: string) {
        const bc = await this.broadcastRepo.findOne({ where: { id: broadcastId } });
        if (!bc) throw new BadRequestException('Broadcast not found');

        const csvLines = [
            'Broadcast ID,Target,Message,Priority,Recipients,Delivered,Read,Acknowledged,Status',
            `${bc.id},${bc.target_type} ${bc.target_value || ''},"${bc.message.replace(/"/g, '""')}",${bc.priority},${bc.total_recipients},${bc.delivered_count},${bc.read_count},${bc.ack_count},${bc.status}`,
        ];
        return csvLines.join('\n');
    }
}
