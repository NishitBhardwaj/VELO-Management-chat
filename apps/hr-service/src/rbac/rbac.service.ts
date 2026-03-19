import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities';
import { ACTION_MIN_ROLE, CommandAction } from '../command/command-parser.service';

// ─── Role Hierarchy (higher index = more power) ──────────

const ROLE_HIERARCHY: string[] = [
    'employee',
    'team_leader',
    'hr',
    'manager',
    'admin',
];

@Injectable()
export class RbacService {
    constructor(
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
    ) { }

    async getUserRole(userId: string): Promise<Role | null> {
        return this.roleRepo.findOne({ where: { user_id: userId } });
    }

    async assignRole(userId: string, role: string, team?: string, department?: string): Promise<Role> {
        let existing = await this.getUserRole(userId);
        if (existing) {
            existing.role = role;
            existing.team = team || existing.team;
            existing.department = department || existing.department;
            return this.roleRepo.save(existing);
        }
        const newRole = this.roleRepo.create({ user_id: userId, role, team, department });
        return this.roleRepo.save(newRole);
    }

    /**
     * Check if a user has permission to execute a specific action.
     * Throws ForbiddenException if not authorized.
     */
    async validatePermission(userId: string, action: CommandAction): Promise<Role> {
        const userRole = await this.getUserRole(userId);
        if (!userRole) {
            throw new ForbiddenException('No role assigned. Contact admin.');
        }

        const minRole = ACTION_MIN_ROLE[action];
        const userLevel = ROLE_HIERARCHY.indexOf(userRole.role);
        const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);

        if (userLevel < requiredLevel) {
            throw new ForbiddenException(
                `Insufficient permissions. Requires: ${minRole}, you have: ${userRole.role}`,
            );
        }

        return userRole;
    }

    getRoleLevel(role: string): number {
        return ROLE_HIERARCHY.indexOf(role);
    }
}
