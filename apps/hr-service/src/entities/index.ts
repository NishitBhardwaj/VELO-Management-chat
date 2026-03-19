import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// ─── Role Entity ─────────────────────────────────────────

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 20 })
    role: string; // employee | team_leader | hr | manager | admin

    @Column({ type: 'varchar', length: 100, nullable: true })
    team: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    department: string;

    @CreateDateColumn()
    created_at: Date;
}

// ─── Attendance Entity ───────────────────────────────────

@Entity('attendance_records')
export class AttendanceRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'varchar', length: 20 })
    status: string; // present | absent | first_half | second_half | leave | late

    @Column({ type: 'uuid' })
    marked_by: string;

    @Column({ type: 'int', default: 0 })
    points_impact: number;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;
}

// ─── Points Transaction Entity ───────────────────────────

@Entity('points_transactions')
export class PointsTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'int' })
    change_amount: number;

    @Column({ type: 'varchar', length: 50 })
    reason: string; // absent | half_day | late | manual | bonus

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'uuid' })
    issued_by: string;

    @Column({ type: 'uuid', nullable: true })
    related_attendance_id: string;

    @CreateDateColumn()
    created_at: Date;
}

// ─── Points Balance Entity ───────────────────────────────

@Entity('points_balance')
export class PointsBalance {
    @Column({ type: 'uuid', primary: true })
    user_id: string;

    @Column({ type: 'int', default: 100 })
    total_points: number;

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    last_updated: Date;
}

// ─── Monthly Summary Entity ──────────────────────────────

@Entity('monthly_summary')
export class MonthlySummary {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'varchar', length: 7 })
    month: string; // "2026-03"

    @Column({ type: 'int', default: 0 })
    total_present: number;

    @Column({ type: 'int', default: 0 })
    total_absent: number;

    @Column({ type: 'int', default: 0 })
    total_half_days: number;

    @Column({ type: 'int', default: 0 })
    total_leaves: number;

    @Column({ type: 'int', default: 0 })
    total_late: number;

    @Column({ type: 'int', default: 0 })
    points_earned: number;

    @Column({ type: 'int', default: 0 })
    points_deducted: number;

    @Column({ type: 'int', default: 0 })
    final_points: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    target_percentage: number;

    @Column({ type: 'timestamp', nullable: true })
    generated_at: Date;
}

// ─── HR Audit Log Entity ─────────────────────────────────

@Entity('hr_audit_log')
export class HrAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    actor_id: string;

    @Column({ type: 'varchar', length: 50 })
    action: string;

    @Column({ type: 'uuid' })
    target_user_id: string;

    @Column({ type: 'jsonb', nullable: true })
    old_value: any;

    @Column({ type: 'jsonb', nullable: true })
    new_value: any;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;

    @CreateDateColumn({ name: 'performed_at' })
    performed_at: Date;
}
