import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord, HrAuditLog } from '../entities';

// ─── Points impact per status ────────────────────────────

const POINTS_MAP: Record<string, number> = {
    present: 0,
    absent: -5,
    first_half: -2,
    second_half: -2,
    leave: -1,
    late: -1,
};

@Injectable()
export class AttendanceService {
    private readonly logger = new Logger(AttendanceService.name);

    constructor(
        @InjectRepository(AttendanceRecord)
        private readonly attendanceRepo: Repository<AttendanceRecord>,
        @InjectRepository(HrAuditLog)
        private readonly auditRepo: Repository<HrAuditLog>,
    ) { }

    /**
     * Mark attendance for a user on a given date.
     */
    async markAttendance(
        targetUserId: string,
        status: string,
        markedBy: string,
        date?: string,
    ): Promise<AttendanceRecord> {
        const today = date || new Date().toISOString().split('T')[0];
        const pointsImpact = POINTS_MAP[status] ?? 0;

        // Check for duplicate
        const existing = await this.attendanceRepo.findOne({
            where: { user_id: targetUserId, date: today },
        });

        if (existing) {
            throw new ConflictException(`Attendance already marked for ${today}`);
        }

        const record = this.attendanceRepo.create({
            user_id: targetUserId,
            date: today,
            status,
            marked_by: markedBy,
            points_impact: pointsImpact,
        });

        const saved = await this.attendanceRepo.save(record);

        // Audit log
        await this.auditRepo.save(
            this.auditRepo.create({
                actor_id: markedBy,
                action: 'mark_attendance',
                target_user_id: targetUserId,
                new_value: { date: today, status, points_impact: pointsImpact },
            }),
        );

        this.logger.log(`Attendance: ${targetUserId} → ${status} (${pointsImpact} pts) by ${markedBy}`);
        return saved;
    }

    /**
     * Edit an existing attendance record (HR/Manager only).
     */
    async editAttendance(
        recordId: string,
        newStatus: string,
        editedBy: string,
    ): Promise<AttendanceRecord> {
        const record = await this.attendanceRepo.findOne({ where: { id: recordId } });
        if (!record) throw new NotFoundException('Attendance record not found');

        const oldValue = { status: record.status, points_impact: record.points_impact };
        record.status = newStatus;
        record.points_impact = POINTS_MAP[newStatus] ?? 0;

        const saved = await this.attendanceRepo.save(record);

        await this.auditRepo.save(
            this.auditRepo.create({
                actor_id: editedBy,
                action: 'edit_attendance',
                target_user_id: record.user_id,
                old_value: oldValue,
                new_value: { status: newStatus, points_impact: record.points_impact },
            }),
        );

        return saved;
    }

    /**
     * Get attendance records for a user in a given month.
     */
    async getMonthlyAttendance(userId: string, month: string): Promise<AttendanceRecord[]> {
        return this.attendanceRepo
            .createQueryBuilder('att')
            .where('att.user_id = :userId', { userId })
            .andWhere("TO_CHAR(att.date, 'YYYY-MM') = :month", { month })
            .orderBy('att.date', 'ASC')
            .getMany();
    }

    /**
     * Get today's attendance for all users (dashboard).
     */
    async getTodayAttendance(): Promise<AttendanceRecord[]> {
        const today = new Date().toISOString().split('T')[0];
        return this.attendanceRepo.find({ where: { date: today } });
    }
}
