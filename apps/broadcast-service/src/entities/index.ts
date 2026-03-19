import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// ─── Broadcast Messages (Master Record) ──────────────────

@Entity('broadcast_messages')
export class BroadcastMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    sender_id: string;

    @Column({ type: 'varchar', length: 15 })
    target_type: string; // ALL | TEAM | ROLE | USER

    @Column({ type: 'varchar', length: 100, nullable: true })
    target_value: string; // team name | role name | user_id

    @Column({ type: 'varchar', length: 10, default: 'INFO' })
    priority: string; // INFO | WARNING | CRITICAL | PRIVATE

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'timestamp', nullable: true })
    scheduled_at: Date;

    @Column({ type: 'boolean', default: false })
    is_recurring: boolean;

    @Column({ type: 'varchar', length: 50, nullable: true })
    recurrence_rule: string;

    @Column({ type: 'boolean', default: false })
    requires_ack: boolean;

    @Column({ type: 'timestamp', nullable: true })
    ack_deadline: Date;

    @Column({ type: 'int', default: 0 })
    total_recipients: number;

    @Column({ type: 'int', default: 0 })
    delivered_count: number;

    @Column({ type: 'int', default: 0 })
    read_count: number;

    @Column({ type: 'int', default: 0 })
    ack_count: number;

    @Column({ type: 'int', default: 0 })
    failed_count: number;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string; // pending | sending | completed | failed | scheduled

    @Column({ type: 'timestamp', nullable: true })
    started_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date;

    @CreateDateColumn()
    created_at: Date;
}

// ─── Broadcast Delivery Log (Per-User Status) ────────────

@Entity('broadcast_delivery_log')
export class BroadcastDeliveryLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    broadcast_id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    delivery_status: string; // pending | delivered | failed

    @Column({ type: 'varchar', length: 15, nullable: true })
    delivery_channel: string; // redis | fcm | cassandra

    @Column({ type: 'boolean', default: false })
    read_status: boolean;

    @Column({ type: 'boolean', default: false })
    acknowledged: boolean;

    @Column({ type: 'timestamp', nullable: true })
    delivered_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    read_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    ack_at: Date;
}

// ─── Broadcast Audit Log ─────────────────────────────────

@Entity('broadcast_audit_log')
export class BroadcastAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    broadcast_id: string;

    @Column({ type: 'uuid' })
    actor_id: string;

    @Column({ type: 'varchar', length: 30 })
    action: string; // created | sent | cancelled | ack_reminder_sent

    @Column({ type: 'jsonb', nullable: true })
    details: any;

    @CreateDateColumn()
    performed_at: Date;
}

// ─── Users Stub (For Local Queries in Fanout Mock) ───────
// Given we don't have direct cross-db relation with Auth service 
// for user listing, in production we would query Redis/Auth API.
// We represent a local cache of team member IDs here.

@Entity('users')
export class UserStub {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    team: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    role: string;
}
