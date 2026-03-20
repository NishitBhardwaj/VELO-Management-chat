import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('social_links')
export class SocialLink {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 100 })
    label: string;

    @Column({ type: 'text' })
    url: string;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User, (user) => user.social_links, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
