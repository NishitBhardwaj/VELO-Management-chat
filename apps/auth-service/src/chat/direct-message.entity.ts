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

    @Column({ type: 'uuid' })
    recipient_id: string;

    @Column({ type: 'text' })
    text: string;

    @CreateDateColumn()
    created_at: Date;
}
