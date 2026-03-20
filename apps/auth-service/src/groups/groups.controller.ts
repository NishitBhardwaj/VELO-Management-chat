import {
    Controller, Get, Post, Put, Delete, Body, Param, Query,
    UseGuards, Request, BadRequestException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupVisibility, MessagePermission } from './entities/group.entity';
import { GroupRole } from './entities/group-member.entity';
import { MeetingStatus } from './entities/group-meeting.entity';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
    constructor(private groupsService: GroupsService) {}

    @Post()
    async createGroup(
        @Request() req,
        @Body('name') name: string,
        @Body('description') description: string,
        @Body('visibility') visibility: GroupVisibility,
        @Body('message_permission') messagePermission: MessagePermission,
    ) {
        if (!name?.trim()) throw new BadRequestException('Group name is required');
        const group = await this.groupsService.createGroup(
            name.trim(), req.user.id, description, visibility, messagePermission,
        );
        return {
            id: group.id,
            name: group.name,
            description: group.description,
            visibility: group.visibility,
            message_permission: group.message_permission,
            invite_code: group.invite_code,
            invite_link: `http://localhost:5173/join/${group.invite_code}`,
        };
    }

    @Get()
    async getMyGroups(@Request() req) {
        return this.groupsService.getMyGroups(req.user.id);
    }

    @Get('public')
    async getPublicGroups() {
        return this.groupsService.getPublicGroups();
    }

    @Post('join')
    async joinByCode(@Request() req, @Body('code') code: string) {
        if (!code?.trim()) throw new BadRequestException('Invite code is required');
        const result = await this.groupsService.joinByCode(code.trim(), req.user.id);
        return {
            group_id: result.group.id,
            group_name: result.group.name,
            role: result.member.role,
            message: `Successfully joined "${result.group.name}"`,
        };
    }

    @Get(':id')
    async getGroupDetails(@Request() req, @Param('id') groupId: string) {
        return this.groupsService.getGroupDetails(groupId, req.user.id);
    }

    @Put(':id')
    async updateGroup(
        @Request() req,
        @Param('id') groupId: string,
        @Body() updates: any,
    ) {
        const allowed = ['name', 'description', 'visibility', 'message_permission', 'avatar_url'];
        const filtered: any = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[key] = updates[key];
        }
        return this.groupsService.updateGroup(groupId, req.user.id, filtered);
    }

    @Put(':id/members/:userId/role')
    async changeMemberRole(
        @Request() req,
        @Param('id') groupId: string,
        @Param('userId') targetUserId: string,
        @Body('role') role: GroupRole,
    ) {
        if (!Object.values(GroupRole).includes(role)) {
            throw new BadRequestException('Invalid role');
        }
        await this.groupsService.changeMemberRole(groupId, req.user.id, targetUserId, role);
        return { message: 'Role updated' };
    }

    @Delete(':id/members/:userId')
    async removeMember(
        @Request() req,
        @Param('id') groupId: string,
        @Param('userId') targetUserId: string,
    ) {
        await this.groupsService.removeMember(groupId, req.user.id, targetUserId);
        return { message: 'Member removed successfully' };
    }

    @Get(':id/messages')
    async getGroupMessages(
        @Request() req,
        @Param('id') groupId: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
    ) {
        // Verify membership
        await this.groupsService.getGroupDetails(groupId, req.user.id);
        const messages = await this.groupsService.getGroupMessages(
            groupId, limit ? parseInt(limit, 10) : 50, before,
        );
        return messages.map(m => ({
            id: m.id,
            chat_id: m.chat_id,
            sender_id: m.sender_id,
            text: m.text,
            created_at: m.created_at.toISOString(),
        }));
    }

    // ─── Analytics Dashboard ───────────────────────────

    @Get(':id/attendance')
    async getGroupAttendance(
        @Request() req,
        @Param('id') groupId: string,
        @Query('date') dateStr?: string,
    ) {
        return this.groupsService.getGroupAttendance(groupId, req.user.id, dateStr);
    }

    // ─── Meetings ────────────────────────────────────

    @Post(':id/meetings')
    async scheduleMeeting(
        @Request() req,
        @Param('id') groupId: string,
        @Body('title') title: string,
        @Body('scheduled_at') scheduledAt: string,
        @Body('duration_minutes') durationMinutes: number,
    ) {
        if (!title?.trim()) throw new BadRequestException('Meeting title is required');
        if (!scheduledAt) throw new BadRequestException('scheduled_at is required');
        const meeting = await this.groupsService.scheduleMeeting(
            groupId, req.user.id, title.trim(), scheduledAt, durationMinutes,
        );
        return {
            id: meeting.id,
            title: meeting.title,
            scheduled_at: meeting.scheduled_at,
            duration_minutes: meeting.duration_minutes,
            meeting_url: `https://meet.jit.si/${meeting.meeting_room_id}`,
            status: meeting.status,
        };
    }

    @Get(':id/meetings')
    async getGroupMeetings(@Request() req, @Param('id') groupId: string) {
        await this.groupsService.getGroupDetails(groupId, req.user.id);
        const meetings = await this.groupsService.getGroupMeetings(groupId);
        return meetings.map(m => ({
            id: m.id,
            title: m.title,
            scheduled_at: m.scheduled_at,
            duration_minutes: m.duration_minutes,
            meeting_url: `https://meet.jit.si/${m.meeting_room_id}`,
            status: m.status,
            created_by: m.created_by,
        }));
    }

    @Put('meetings/:meetingId/status')
    async updateMeetingStatus(
        @Request() req,
        @Param('meetingId') meetingId: string,
        @Body('status') status: MeetingStatus,
    ) {
        if (!Object.values(MeetingStatus).includes(status)) {
            throw new BadRequestException('Invalid status');
        }
        const meeting = await this.groupsService.updateMeetingStatus(meetingId, req.user.id, status);
        return {
            id: meeting.id,
            status: meeting.status,
            meeting_url: `https://meet.jit.si/${meeting.meeting_room_id}`,
        };
    }
}
