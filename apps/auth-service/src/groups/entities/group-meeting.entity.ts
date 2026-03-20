import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from './group.entity';

export enum MeetingStatus {
    SCHEDULED = 'scheduled',
    ACTIVE = 'active',
    ENDED = 'ended',
}

@Entity('group_meetings_v2')
export class GroupMeeting {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    group_id: string;

    @Column({ type: 'varchar', length: 200 })
    title: string;

    @Column({ type: 'timestamp' })
    scheduled_at: Date;

    @Column({ type: 'int', default: 30 })
    duration_minutes: number;

    @Column({ type: 'varchar', length: 100 })
    meeting_room_id: string;

    @Column({ type: 'uuid' })
    created_by: string;

    @Column({ type: 'varchar', length: 15, default: MeetingStatus.SCHEDULED })
    status: MeetingStatus;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => Group, (group) => group.meetings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    creator: User;
}
