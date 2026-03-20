import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from './group.entity';

export enum GroupRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    HR = 'hr',
    MEMBER = 'member',
}

@Entity('group_members_v2')
@Unique(['group_id', 'user_id'])
export class GroupMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    group_id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 10, default: GroupRole.MEMBER })
    role: GroupRole;

    @CreateDateColumn()
    joined_at: Date;

    @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
}
