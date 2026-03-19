import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// ─── Email Connection (user ↔ Gmail link) ────────────────

@Entity('email_connections')
export class EmailConnection {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 255 })
    gmail_address: string;

    @Column({ type: 'varchar', length: 255 })
    vault_token_key: string; // Encrypted refresh token reference

    @Column({ type: 'bigint', nullable: true })
    history_id: number;

    @Column({ type: 'timestamp', nullable: true })
    watch_expiry: Date;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    sync_status: string;

    @CreateDateColumn()
    connected_at: Date;
}

// ─── Email Metadata ──────────────────────────────────────

@Entity('email_metadata')
export class EmailMetadata {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 50 })
    gmail_message_id: string;

    @Column({ type: 'varchar', length: 50 })
    gmail_thread_id: string;

    @Column({ type: 'text', nullable: true })
    subject: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    sender_address: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    sender_name: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    category: string; // work | promotion | task | urgent | social | finance

    @Column({ type: 'boolean', default: false })
    has_attachments: boolean;

    @Column({ type: 'int', default: 0 })
    attachment_count: number;

    @Column({ type: 'boolean', default: false })
    is_read: boolean;

    @Column({ type: 'boolean', default: false })
    is_starred: boolean;

    @Column({ type: 'text', nullable: true })
    snippet: string;

    @Column({ type: 'timestamp', nullable: true })
    received_at: Date;
}

// ─── Email Audit Log ─────────────────────────────────────

@Entity('email_audit_log')
export class EmailAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 20 })
    action: string; // read | reply | forward | archive | connect | disconnect

    @Column({ type: 'varchar', length: 50, nullable: true })
    gmail_thread_id: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    gmail_message_id: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    recipient: string;

    @CreateDateColumn()
    performed_at: Date;
}
