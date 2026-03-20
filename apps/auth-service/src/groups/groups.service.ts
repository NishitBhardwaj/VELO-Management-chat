import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, GroupType, GroupVisibility, MessagePermission } from './entities/group.entity';
import { GroupMember, GroupRole } from './entities/group-member.entity';
import { GroupMeeting, MeetingStatus } from './entities/group-meeting.entity';
import { User } from '../users/entities/user.entity';
import { DirectMessage } from '../chat/direct-message.entity';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

@Injectable()
export class GroupsService {
    constructor(
        @InjectRepository(Group)
        private groupRepo: Repository<Group>,
        @InjectRepository(GroupMember)
        private memberRepo: Repository<GroupMember>,
        @InjectRepository(GroupMeeting)
        private meetingRepo: Repository<GroupMeeting>,
        @InjectRepository(DirectMessage)
        private messageRepo: Repository<DirectMessage>,
        @InjectRepository(Attendance)
        private attendanceRepo: Repository<Attendance>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) {}

    private generateInviteCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ─── Create Group ──────────────────────────────────

    async createGroup(
        name: string,
        creatorId: string,
        description?: string,
        visibility?: GroupVisibility,
        messagePermission?: MessagePermission,
    ): Promise<Group> {
        let inviteCode: string;
        // Ensure unique code
        do {
            inviteCode = this.generateInviteCode();
        } while (await this.groupRepo.findOne({ where: { invite_code: inviteCode } }));

        const group = this.groupRepo.create({
            name,
            description: description || null,
            visibility: visibility || GroupVisibility.PRIVATE,
            message_permission: messagePermission || MessagePermission.EVERYONE,
            invite_code: inviteCode,
            created_by: creatorId,
        });
        const saved = await this.groupRepo.save(group);

        // Add creator as owner
        const member = this.memberRepo.create({
            group_id: saved.id,
            user_id: creatorId,
            role: GroupRole.OWNER,
        });
        await this.memberRepo.save(member);

        return saved;
    }

    // ─── Join by Code ──────────────────────────────────

    async joinByCode(code: string, userId: string): Promise<{ group: Group; member: GroupMember }> {
        const group = await this.groupRepo.findOne({ where: { invite_code: code } });
        if (!group) {
            throw new NotFoundException('Invalid invite code');
        }

        const existing = await this.memberRepo.findOne({
            where: { group_id: group.id, user_id: userId },
        });
        if (existing) {
            throw new ConflictException('You are already a member of this group');
        }

        const member = this.memberRepo.create({
            group_id: group.id,
            user_id: userId,
            role: GroupRole.MEMBER,
        });
        const savedMember = await this.memberRepo.save(member);

        return { group, member: savedMember };
    }

    // ─── List My Groups ────────────────────────────────

    async getMyGroups(userId: string): Promise<any[]> {
        const memberships = await this.memberRepo.find({
            where: { user_id: userId },
            relations: ['group'],
            order: { joined_at: 'DESC' },
        });

        return memberships.map(m => ({
            id: m.group.id,
            name: m.group.name,
            description: m.group.description,
            avatar_url: m.group.avatar_url,
            visibility: m.group.visibility,
            message_permission: m.group.message_permission,
            invite_code: m.group.invite_code,
            my_role: m.role,
            joined_at: m.joined_at,
        }));
    }

    // ─── List Public Groups ────────────────────────────

    async getPublicGroups(): Promise<Group[]> {
        return this.groupRepo.find({
            where: { visibility: GroupVisibility.PUBLIC },
            order: { created_at: 'DESC' },
        });
    }

    // ─── Get Group Details ─────────────────────────────

    async getGroupDetails(groupId: string, userId: string): Promise<any> {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Group not found');

        const membership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (!membership) throw new ForbiddenException('Not a member of this group');

        const members = await this.memberRepo.find({
            where: { group_id: groupId },
            relations: ['user'],
            order: { joined_at: 'ASC' },
        });

        return {
            ...group,
            my_role: membership.role,
            members: members.map(m => ({
                id: m.user_id,
                display_name: m.user?.display_name,
                avatar_url: m.user?.avatar_url,
                role: m.role,
                joined_at: m.joined_at,
            })),
        };
    }

    // ─── Update Group Settings ─────────────────────────

    async updateGroup(groupId: string, userId: string, updates: Partial<Group>): Promise<Group> {
        const membership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (!membership || (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN)) {
            throw new ForbiddenException('Only owners and admins can update group settings');
        }

        await this.groupRepo.update(groupId, updates);
        return this.groupRepo.findOne({ where: { id: groupId } });
    }

    // ─── Change Member Role ────────────────────────────

    async changeMemberRole(groupId: string, actorId: string, targetUserId: string, newRole: GroupRole): Promise<void> {
        const actorMembership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: actorId },
        });
        if (!actorMembership || (actorMembership.role !== GroupRole.OWNER && actorMembership.role !== GroupRole.ADMIN)) {
            throw new ForbiddenException('Only owners and admins can change roles');
        }

        const targetMembership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: targetUserId },
        });
        if (!targetMembership) throw new NotFoundException('User is not a member');

        targetMembership.role = newRole;
        await this.memberRepo.save(targetMembership);
    }

    // ─── Remove Member (Kick or Leave) ───────────────────

    async removeMember(groupId: string, actorId: string, targetUserId: string): Promise<void> {
        const actorMembership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: actorId },
        });

        if (actorId !== targetUserId) {
            if (!actorMembership || (actorMembership.role !== GroupRole.OWNER && actorMembership.role !== GroupRole.ADMIN)) {
                throw new ForbiddenException('Only owners and admins can remove other members');
            }
        }

        const targetMembership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: targetUserId },
        });
        if (!targetMembership) throw new NotFoundException('User is not a member');

        if (actorId !== targetUserId && targetMembership.role === GroupRole.OWNER) {
            throw new ForbiddenException('Cannot remove the group owner');
        }
        // Admins cannot kick other admins or owners
        if (actorId !== targetUserId && actorMembership?.role === GroupRole.ADMIN && (targetMembership.role === GroupRole.ADMIN || targetMembership.role === GroupRole.OWNER)) {
            throw new ForbiddenException('Admins cannot remove other admins or owners');
        }

        await this.memberRepo.remove(targetMembership);
    }

    // ─── Check Send Permission ─────────────────────────

    async canSendMessage(groupId: string, userId: string): Promise<boolean> {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) return false;

        const membership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (!membership) return false;

        if (group.message_permission === MessagePermission.EVERYONE) return true;

        // admin_only: only owner, admin, hr can send
        return [GroupRole.OWNER, GroupRole.ADMIN, GroupRole.HR].includes(membership.role);
    }

    // ─── Admin Verification ────────────────────────────

    async isAdmin(groupId: string, userId: string): Promise<boolean> {
        const membership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (!membership) return false;
        return membership.role === GroupRole.OWNER || membership.role === GroupRole.ADMIN;
    }

    // ─── Command Execution ─────────────────────────────

    async processAttendanceCommands(groupId: string, actorId: string, extractedCommands: any[]) {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) return { error: 'Group not found' };

        // 1. Strict Group Type check
        if (group.group_type !== GroupType.PROFESSIONAL) {
            return { error: 'Commands are only enabled in professional groups.' };
        }

        // 2. Strict Permissions check
        const actorMembership = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: actorId } });
        if (!actorMembership || ![GroupRole.OWNER, GroupRole.ADMIN, GroupRole.HR].includes(actorMembership.role)) {
            return { error: 'Permission denied: Only Owner, Admin, or HR can process commands' };
        }

        const actor = await this.userRepo.findOne({ where: { id: actorId } });
        const successfulUpdates = [];

        // 3. Process each Extracted Command
        for (const cmd of extractedCommands) {
            const identifierText = cmd.identifier; // 'john' or 'jane@gmail.com'
            let targetUser: User;

            if (identifierText.includes('@')) {
                // It's an email
                targetUser = await this.userRepo.findOne({ where: { email: identifierText } });
            } else {
                targetUser = await this.userRepo.findOne({ where: { username: identifierText } });
            }

            if (!targetUser) continue;

            // Ensure target is actually in the group
            const targetMembership = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: targetUser.id } });
            if (!targetMembership) continue;

            const today = new Date().toISOString().split('T')[0];
            
            // Upsert Attendance for today
            let record = await this.attendanceRepo.findOne({ where: { group_id: groupId, user_id: targetUser.id, date: new Date(today) } });
            if (!record) {
                record = this.attendanceRepo.create({
                    group_id: groupId,
                    user_id: targetUser.id,
                    date: new Date(today),
                });
            }
            
            record.status = cmd.status;
            record.marked_by = actorId;
            await this.attendanceRepo.save(record);

            successfulUpdates.push({
                user: targetUser,
                status: cmd.status,
            });
        }

        return { error: null, group, actor, updates: successfulUpdates };
    }

    async getGroupOwner(groupId: string): Promise<GroupMember | null> {
        return this.memberRepo.findOne({
            where: { group_id: groupId, role: GroupRole.OWNER },
        });
    }

    // ─── Analytics Dashboard ───────────────────────────

    async getGroupAttendance(groupId: string, actorId: string, dateStr?: string) {
        if (!await this.isAdmin(groupId, actorId)) {
            throw new ForbiddenException('Only owners and admins can view attendance');
        }

        let query = this.attendanceRepo.createQueryBuilder('attendance')
            .leftJoinAndSelect('attendance.user', 'user')
            .leftJoinAndSelect('attendance.marker', 'marker')
            .where('attendance.group_id = :groupId', { groupId });

        if (dateStr) {
            query = query.andWhere('attendance.date = :date', { date: dateStr });
        }

        const records = await query.orderBy('attendance.date', 'DESC').getMany();
        
        // Simple aggregate
        const summary = {
            present: records.filter(r => r.status === AttendanceStatus.PRESENT).length,
            absent: records.filter(r => r.status === AttendanceStatus.ABSENT).length,
            half_day: records.filter(r => r.status.includes('Half Day')).length,
            leave: records.filter(r => r.status === AttendanceStatus.LEAVE).length,
        };

        return { summary, records };
    }

    // ─── Group Messages ────────────────────────────────

    async getGroupMessages(groupId: string, limit: number = 50, before?: string): Promise<DirectMessage[]> {
        const chatId = `group:${groupId}`;
        const where: any = { chat_id: chatId };
        if (before) {
            const { LessThan } = require('typeorm');
            where.created_at = LessThan(new Date(before));
        }
        return this.messageRepo.find({ where, order: { created_at: 'ASC' }, take: limit });
    }

    // ─── Meetings ──────────────────────────────────────

    async scheduleMeeting(
        groupId: string,
        creatorId: string,
        title: string,
        scheduledAt: string,
        durationMinutes: number,
    ): Promise<GroupMeeting> {
        const membership = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: creatorId },
        });
        if (!membership) throw new ForbiddenException('Not a member');

        const roomId = `velo-${groupId.slice(0, 8)}-${Date.now().toString(36)}`;
        const meeting = this.meetingRepo.create({
            group_id: groupId,
            title,
            scheduled_at: new Date(scheduledAt),
            duration_minutes: durationMinutes || 30,
            meeting_room_id: roomId,
            created_by: creatorId,
            status: MeetingStatus.SCHEDULED,
        });
        return this.meetingRepo.save(meeting);
    }

    async getGroupMeetings(groupId: string): Promise<GroupMeeting[]> {
        return this.meetingRepo.find({
            where: { group_id: groupId },
            order: { scheduled_at: 'DESC' },
            take: 20,
        });
    }

    async updateMeetingStatus(meetingId: string, userId: string, status: MeetingStatus): Promise<GroupMeeting> {
        const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
        if (!meeting) throw new NotFoundException('Meeting not found');

        const membership = await this.memberRepo.findOne({
            where: { group_id: meeting.group_id, user_id: userId },
        });
        if (!membership || (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN)) {
            throw new ForbiddenException('Only owners and admins can manage meetings');
        }

        meeting.status = status;
        return this.meetingRepo.save(meeting);
    }

    // ─── Get user's group IDs (for WebSocket room join) ─

    async getUserGroupIds(userId: string): Promise<string[]> {
        const memberships = await this.memberRepo.find({
            where: { user_id: userId },
            select: ['group_id'],
        });
        return memberships.map(m => m.group_id);
    }
}
