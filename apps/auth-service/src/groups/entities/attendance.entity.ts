import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';

export enum AttendanceStatus {
    PRESENT = 'Present',
    ABSENT = 'Absent',
    FIRST_HALF = 'First Half Day',
    SECOND_HALF = 'Second Half Day',
    LEAVE = 'Leave Applied',
}

@Entity('attendances')
export class Attendance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column('uuid')
    group_id: string;

    @ManyToOne(() => Group)
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @Column({
        type: 'enum',
        enum: AttendanceStatus,
    })
    status: AttendanceStatus;

    @Column({ type: 'date' })
    date: Date;

    @Column('uuid')
    marked_by: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'marked_by' })
    marker: User;

    @CreateDateColumn()
    created_at: Date;
}
