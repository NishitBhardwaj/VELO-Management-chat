import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('direct_messages')
@Index(['chat_id', 'created_at'])
export class DirectMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 200 })
    chat_id: string;

    @Column({ type: 'uuid' })
    sender_id: string;

    @Column({ type: 'uuid', nullable: true })
    recipient_id: string;

    @Column({ type: 'text' })
    text: string;

    @Column({ type: 'varchar', nullable: true })
    media_url?: string;

    @Column({ type: 'varchar', nullable: true })
    media_type?: string;

    @Column({ type: 'varchar', nullable: true })
    media_name?: string;

    @Column({ type: 'uuid', nullable: true })
    reply_to_id?: string;

    @Column({ type: 'jsonb', nullable: true, default: {} })
    reactions: Record<string, string[]>;

    @Column({ type: 'varchar', default: 'SENT' })
    status: string; // SENT, DELIVERED, READ

    @Column({ type: 'boolean', default: false })
    is_ephemeral: boolean;

    @Column({ type: 'jsonb', nullable: true })
    poll_data?: any;

    @Column({ type: 'jsonb', nullable: true })
    whiteboard_data?: any;

    @CreateDateColumn()
    created_at: Date;
}
