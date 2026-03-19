import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Client } from 'cassandra-driver';
import { CASSANDRA_CLIENT } from '../cassandra/cassandra.module';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatRouter implements OnModuleInit, OnModuleDestroy {
    private redisPub: Redis;
    private redisSub: Redis;
    private kafkaProducer: any;
    private kafkaConsumer: any;

    constructor(
        @Inject(CASSANDRA_CLIENT) private readonly cassandraClient: Client
    ) {
        this.redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

        const kafka = new Kafka({
            clientId: 'chat-router',
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        });
        this.kafkaProducer = kafka.producer();
        this.kafkaConsumer = kafka.consumer({ groupId: 'chat-cassandra-persister' });
    }

    async onModuleInit() {
        await this.kafkaProducer.connect();
        await this.kafkaConsumer.connect();

        // Redis Pub/Sub: Listen for live messages from API Gateway WebSockets
        this.redisSub.subscribe('chat.inbound', (err) => {
            if (err) console.error('Failed to subscribe chat.inbound', err);
        });

        this.redisSub.on('message', async (channel, message) => {
            if (channel === 'chat.inbound') {
                const payload = JSON.parse(message);
                await this.handleInboundMessage(payload);
            }
        });

        // Kafka Consumer: Consume msg.sent to asynchronously persist to Cassandra
        await this.kafkaConsumer.subscribe({ topic: 'msg.sent', fromBeginning: false });
        await this.kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const msgEvent = JSON.parse(message.value.toString());
                await this.persistToCassandra(msgEvent);
            },
        });

        console.log('🚀 Chat Router Initialized: Redis Subscribed & Kafka Connected');
    }

    async onModuleDestroy() {
        await this.kafkaProducer.disconnect();
        await this.kafkaConsumer.disconnect();
        this.redisPub.disconnect();
        this.redisSub.disconnect();
    }

    // 1. Receive incoming message from gateway
    private async handleInboundMessage(payload: any) {
        const { sender_id, recipient_id, chat_id, message_type, encrypted_payload } = payload;

        // Generate TimeUUID for ordered messages
        const message_id = uuidv1();
        const finalChatId = chat_id || recipient_id || uuidv4();

        const msgRecord = {
            chat_id: finalChatId,
            message_id,
            sender_id,
            recipient_id,
            message_type: message_type || 'text',
            encrypted_payload: encrypted_payload || '',
            created_at: new Date().toISOString()
        };

        // 2. Publish to Kafka to asynchronously persist (High Reliability)
        await this.kafkaProducer.send({
            topic: 'msg.sent',
            messages: [{ value: JSON.stringify(msgRecord) }],
        });

        // 3. Immediately route to live clients via Redis Event Bus if recipient is online
        const isOnline = await this.redisPub.get(`online:${recipient_id}`);
        if (isOnline) {
            // Forward directly to API Gateway to push to socket
            await this.redisPub.publish('gateway.messages', JSON.stringify({
                to_user_id: recipient_id,
                event: 'new_message',
                data: msgRecord
            }));
        } else {
            // If offline, publish to Delivery Topic for Push Notifications service
            await this.kafkaProducer.send({
                topic: 'msg.delivery',
                messages: [{ value: JSON.stringify(msgRecord) }]
            });
        }
    }

    // 4. Kafka Worker async persistence handler
    private async persistToCassandra(msg: any) {
        const query = `
      INSERT INTO messages_by_chat 
        (chat_id, message_id, sender_id, message_type, encrypted_payload, created_at) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
        const params = [
            msg.chat_id,
            msg.message_id,
            msg.sender_id,
            msg.message_type,
            msg.encrypted_payload,
            new Date(msg.created_at)
        ];

        try {
            await this.cassandraClient.execute(query, params, { prepare: true });
        } catch (err) {
            console.error('Failed to persist to Cassandra:', err.message);
        }
    }
}
