import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CommandParserService, ParsedCommand } from './command-parser.service';
import { RbacService } from '../rbac/rbac.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PointsService } from '../points/points.service';

// ─── Status map from command action to DB value ──────────

const STATUS_MAP: Record<string, string> = {
    PRESENT: 'present',
    ABSENT: 'absent',
    FIRST_HALF_DAY: 'first_half',
    SECOND_HALF_DAY: 'second_half',
};

@Controller('hr')
export class CommandController {
    constructor(
        private readonly parser: CommandParserService,
        private readonly rbac: RbacService,
        private readonly attendance: AttendanceService,
        private readonly points: PointsService,
    ) { }

    // ─── POST /hr/command ──────────────────────────────────
    // Main entry point: accepts a raw chat command string
    @Post('command')
    @HttpCode(HttpStatus.OK)
    async executeCommand(
        @Body() body: { message: string; sender_id: string },
    ) {
        const { message, sender_id } = body;

        // Parse the command
        const parsed = this.parser.parse(message);
        if (!parsed) {
            return { handled: false, reason: 'Not a recognized command' };
        }

        // Validate RBAC
        const role = await this.rbac.validatePermission(sender_id, parsed.action);

        // Route to handler
        switch (parsed.action) {
            case 'PRESENT':
            case 'ABSENT':
            case 'FIRST_HALF_DAY':
            case 'SECOND_HALF_DAY':
                return this.handleAttendance(parsed, sender_id);

            case 'POINTS':
                return this.handlePoints(parsed, sender_id);

            case 'ANNOUNCE':
                return this.handleAnnounce(parsed, sender_id, role.role);

            default:
                return { handled: false, reason: 'Unknown action' };
        }
    }

    // ─── Attendance Handler ────────────────────────────────

    private async handleAttendance(cmd: ParsedCommand, senderId: string) {
        // For now, targetUsername is used as the user_id
        // In production, we'd resolve @username → UUID via user service
        const targetId = cmd.targetUsername!; // Will be resolved to UUID

        const status = STATUS_MAP[cmd.action];
        const record = await this.attendance.markAttendance(targetId, status, senderId);

        // Auto-deduct points for non-present statuses
        if (record.points_impact !== 0) {
            await this.points.changePoints(
                targetId,
                record.points_impact,
                status,
                senderId,
                `Auto: ${cmd.raw}`,
                record.id,
            );
        }

        return {
            handled: true,
            action: cmd.action,
            target: cmd.targetUsername,
            status,
            points_impact: record.points_impact,
            record_id: record.id,
            message: `✅ ${cmd.targetUsername} marked as ${status}${record.points_impact ? ` (${record.points_impact} pts)` : ''}`,
        };
    }

    // ─── Points Handler ────────────────────────────────────

    private async handlePoints(cmd: ParsedCommand, senderId: string) {
        const targetId = cmd.targetUsername!;
        const amount = cmd.pointsValue!;

        const result = await this.points.changePoints(
            targetId,
            amount,
            'manual',
            senderId,
            `Manual: ${cmd.raw}`,
        );

        return {
            handled: true,
            action: 'POINTS',
            target: cmd.targetUsername,
            amount,
            new_balance: result.balance.total_points,
            message: `✅ ${amount >= 0 ? '+' : ''}${amount} points → ${cmd.targetUsername} (total: ${result.balance.total_points})`,
        };
    }

    // ─── Announce Handler ──────────────────────────────────

    private async handleAnnounce(cmd: ParsedCommand, senderId: string, senderRole: string) {
        // In production, this would emit to Kafka → Broadcast Service
        return {
            handled: true,
            action: 'ANNOUNCE',
            message: cmd.message,
            sender_role: senderRole,
            broadcast_message: `📢 Announcement: ${cmd.message}`,
        };
    }

    // ─── GET /hr/health ────────────────────────────────────

    @Get('health')
    health() {
        return { status: 'ok', service: 'hr-service', timestamp: new Date().toISOString() };
    }

    // ─── POST /hr/role ─────────────────────────────────────
    // Assign a role to a user
    @Post('role')
    async assignRole(
        @Body() body: { user_id: string; role: string; team?: string; department?: string },
    ) {
        const saved = await this.rbac.assignRole(body.user_id, body.role, body.team, body.department);
        return { message: `Role ${body.role} assigned`, role: saved };
    }

    // ─── GET /hr/attendance/:userId ────────────────────────
    @Get('attendance/:userId')
    async getAttendance(
        @Param('userId') userId: string,
        @Query('month') month?: string,
    ) {
        const m = month || new Date().toISOString().slice(0, 7);
        const records = await this.attendance.getMonthlyAttendance(userId, m);
        const balance = await this.points.getBalance(userId);
        return { user_id: userId, month: m, records, points_balance: balance };
    }

    // ─── GET /hr/attendance-today ──────────────────────────
    @Get('attendance-today')
    async getTodayAttendance() {
        const records = await this.attendance.getTodayAttendance();
        return { date: new Date().toISOString().split('T')[0], records, count: records.length };
    }

    // ─── GET /hr/points/:userId ────────────────────────────
    @Get('points/:userId')
    async getPointsHistory(
        @Param('userId') userId: string,
    ) {
        const balance = await this.points.getBalance(userId);
        const history = await this.points.getHistory(userId);
        return { user_id: userId, balance, history };
    }

    // ─── POST /hr/parse-test ───────────────────────────────
    // Utility: test command parsing without executing
    @Post('parse-test')
    parseTest(@Body() body: { message: string }) {
        const result = this.parser.parse(body.message);
        return { input: body.message, parsed: result };
    }
}
