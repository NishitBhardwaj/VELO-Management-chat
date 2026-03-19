import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kafka, Consumer } from 'kafkajs';
import { BroadcastMessage, BroadcastDeliveryLog, UserStub } from '../entities';

@Injectable()
export class FanoutWorker implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FanoutWorker.name);
    private kafka: Kafka;
    private consumer: Consumer;

    constructor(
        @InjectRepository(BroadcastMessage)
        private readonly broadcastRepo: Repository<BroadcastMessage>,
        @InjectRepository(BroadcastDeliveryLog)
        private readonly deliveryRepo: Repository<BroadcastDeliveryLog>,
        @InjectRepository(UserStub)
        private readonly userRepo: Repository<UserStub>,
    ) {
        this.kafka = new Kafka({
            clientId: 'fanout-worker',
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        });
        this.consumer = this.kafka.consumer({ groupId: 'broadcast-fanout-group' });
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            await this.consumer.subscribe({ topic: 'broadcast.events', fromBeginning: true });

            await this.consumer.run({
                eachMessage: async ({ message }) => {
                    if (!message.value) return;
                    try {
                        const event = JSON.parse(message.value.toString());
                        await this.processFanout(event);
                    } catch (err) {
                        this.logger.error('Error processing broadcast event', err);
                    }
                },
            });
            this.logger.log('Fanout Worker listening on topic: broadcast.events');
        } catch (err) {
            this.logger.error('Failed to start Fanout Worker', err);
        }
    }

    async onModuleDestroy() {
        await this.consumer.disconnect();
    }

    /**
     * Process the fanout strategy.
     */
    private async processFanout(event: {
        broadcast_id: string;
        target_type: string;
        target_value?: string;
        message: string;
        priority: string;
    }) {
        this.logger.log(`Processing Fan-out for Broadcast [${event.broadcast_id}] TARGET: ${event.target_type}`);

        // Update status to processing
        await this.broadcastRepo.update(event.broadcast_id, { status: 'processing' });

        let targetUserIds: string[] = [];

        // ─── Fetch Target Users (Mocked resolution) ──────────────
        // In production, this would query Auth/User Service or a Redis cache 
        // of active employees. We mock it here by querying UserStub.
        if (event.target_type === 'ALL') {
            const users = await this.userRepo.find({ select: ['id'] });
            targetUserIds = users.map(u => u.id);
        } else if (event.target_type === 'TEAM') {
            const users = await this.userRepo.find({ where: { team: event.target_value }, select: ['id'] });
            targetUserIds = users.map(u => u.id);
        } else if (event.target_type === 'ROLE') {
            const users = await this.userRepo.find({ where: { role: event.target_value }, select: ['id'] });
            targetUserIds = users.map(u => u.id);
        } else if (event.target_type === 'PRIVATE' && event.target_value) {
            // For private, target_value is the username. 
            // We assume the user exists, creating a mock ID for demonstration if not found.
            targetUserIds = [event.target_value];
        }

        // Fallback logic for testing without seed data: simulate 5 users if none found
        if (targetUserIds.length === 0 && event.target_type !== 'PRIVATE') {
            this.logger.warn('No users found in DB. Simulating 5 target users for test fan-out.');
            targetUserIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
        }

        // ─── Batch processing (100 users per batch) ──────────────
        const BATCH_SIZE = 100;
        let deliveredCount = 0;

        for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
            const batch = targetUserIds.slice(i, i + BATCH_SIZE);
            const deliveryLogs = batch.map(uid => this.deliveryRepo.create({
                broadcast_id: event.broadcast_id,
                user_id: uid,
                delivery_status: 'delivered',  // Simulated instant delivery
                delivery_channel: 'redis',     // Or FCM if offline
                delivered_at: new Date(),
            }));

            // Insert tracking logs
            await this.deliveryRepo.save(deliveryLogs);
            deliveredCount += batch.length;

            this.logger.log(`Batched ${batch.length} deliveries. Total delivered so far: ${deliveredCount}`);
        }

        // ─── Finalize ──────────────────────────────────────────
        await this.broadcastRepo.update(event.broadcast_id, {
            status: 'completed',
            total_recipients: targetUserIds.length,
            delivered_count: deliveredCount,
            completed_at: new Date(),
        });

        this.logger.log(`Broadcast [${event.broadcast_id}] completed. Delivered to ${deliveredCount} users.`);
    }
}
