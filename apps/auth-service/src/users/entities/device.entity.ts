import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('devices')
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    device_name: string;

    @Column({ type: 'text', nullable: true })
    device_token: string;

    @Column({ type: 'varchar', length: 10 })
    platform: string; // web | android

    @Column({ type: 'timestamp', nullable: true })
    last_active: Date;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
