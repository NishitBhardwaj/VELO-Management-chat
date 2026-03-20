import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GroupMember } from './group-member.entity';
import { GroupMeeting } from './group-meeting.entity';

export enum GroupVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
}

export enum MessagePermission {
    EVERYONE = 'everyone',
    ADMIN_ONLY = 'admin_only',
}

export enum GroupType {
    STANDARD = 'standard',
    PROFESSIONAL = 'professional',
}

@Entity('velo_groups')
export class Group {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    avatar_url: string;

    @Column({ type: 'varchar', length: 10, default: GroupVisibility.PRIVATE })
    visibility: GroupVisibility;

    @Column({ type: 'varchar', length: 15, default: MessagePermission.EVERYONE })
    message_permission: MessagePermission;

    @Column({ type: 'varchar', length: 20, default: GroupType.STANDARD })
    group_type: GroupType;

    @Column({ type: 'varchar', length: 150, nullable: true })
    organization_name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    sector: string;

    @Column({ type: 'varchar', length: 8, unique: true })
    invite_code: string;

    @Column({ type: 'uuid' })
    created_by: string;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @OneToMany(() => GroupMember, (member) => member.group)
    members: GroupMember[];

    @OneToMany(() => GroupMeeting, (meeting) => meeting.group)
    meetings: GroupMeeting[];
}
