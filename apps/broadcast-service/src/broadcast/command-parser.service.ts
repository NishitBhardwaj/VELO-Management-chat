import { Injectable, BadRequestException } from '@nestjs/common';

export type BroadcastAction = 'ALL' | 'TEAM' | 'ROLE' | 'PRIVATE';
export type PriorityLevel = 'INFO' | 'WARNING' | 'CRITICAL' | 'PRIVATE';

export interface ParsedBroadcastCommand {
    action: BroadcastAction;
    targetValue?: string; // team name, role, or user
    message: string;
    priority: PriorityLevel;
    requiresAck: boolean;
    scheduledAt?: Date;
    recurrenceRule?: string;
    isEmergency: boolean;
    raw: string;
}

@Injectable()
export class CommandParserService {
    /**
     * Parse a raw broadcast command message.
     *
     * Grammar:
     *   -ANN_ALL "Message content" [PRIORITY]
     *   -ANN_TEAM Sales "Message content" [PRIORITY]
     *   -ANN_ROLE manager "Message content" [PRIORITY]
     *   -ANN_PRIVATE @username "Message content"
     */
    parse(rawMessage: string): ParsedBroadcastCommand | null {
        const trimmed = rawMessage.trim();
        if (!trimmed.startsWith('-ANN_')) return null;

        // Default priority
        let priority: PriorityLevel = 'INFO';
        if (trimmed.includes('--urgent')) priority = 'CRITICAL';
        else if (trimmed.includes('--warning')) priority = 'WARNING';

        const requiresAck = trimmed.includes('--ack');
        const isEmergency = trimmed.includes('--emergency');

        let scheduledAt: Date | undefined;
        const scheduleMatch = trimmed.match(/--schedule\s+"([^"]+)"/);
        if (scheduleMatch) scheduledAt = new Date(scheduleMatch[1]);

        let recurrenceRule: string | undefined;
        const recurringMatch = trimmed.match(/--recurring\s+"([^"]+)"/);
        if (recurringMatch) recurrenceRule = recurringMatch[1];

        // Remove flags from string to simplify regex matches for the message
        const cleanStr = trimmed
            .replace(/--(urgent|warning|ack|emergency)/g, '')
            .replace(/--schedule\s+"[^"]+"/g, '')
            .replace(/--recurring\s+"[^"]+"/g, '')
            .trim();

        // ─── -ANN_ALL "message" ────────────────────────────────
        if (cleanStr.startsWith('-ANN_ALL ')) {
            const rest = cleanStr.slice(9).trim();
            const match = rest.match(/^"(.+)"/s) || rest.match(/^'(.+)'/s) || rest.match(/^(.+)/s);
            if (!match) throw new BadRequestException('Usage: -ANN_ALL "message"');
            return { action: 'ALL', message: match[1].trim(), priority, requiresAck, isEmergency, scheduledAt, recurrenceRule, raw: trimmed };
        }

        // ─── -ANN_TEAM TeamName "message" ──────────────────────
        if (cleanStr.startsWith('-ANN_TEAM ')) {
            const rest = cleanStr.slice(10).trim();
            const match = rest.match(/^(\w+)\s+"(.+)"/s) || rest.match(/^(\w+)\s+'(.+)'/s) || rest.match(/^(\w+)\s+(.+)/s);
            if (!match) throw new BadRequestException('Usage: -ANN_TEAM TeamName "message"');
            return { action: 'TEAM', targetValue: match[1], message: match[2].trim(), priority, requiresAck, isEmergency, scheduledAt, recurrenceRule, raw: trimmed };
        }

        // ─── -ANN_ROLE RoleName "message" ──────────────────────
        if (cleanStr.startsWith('-ANN_ROLE ')) {
            const rest = cleanStr.slice(10).trim();
            const match = rest.match(/^(\w+)\s+"(.+)"/s) || rest.match(/^(\w+)\s+'(.+)'/s) || rest.match(/^(\w+)\s+(.+)/s);
            if (!match) throw new BadRequestException('Usage: -ANN_ROLE RoleName "message"');
            return { action: 'ROLE', targetValue: match[1], message: match[2].trim(), priority, requiresAck, isEmergency, scheduledAt, recurrenceRule, raw: trimmed };
        }

        // ─── -ANN_PRIVATE @username "message" ──────────────────
        if (cleanStr.startsWith('-ANN_PRIVATE ')) {
            const rest = cleanStr.slice(13).trim();
            const match = rest.match(/^@(\w+)\s+"(.+)"/s) || rest.match(/^@(\w+)\s+'(.+)'/s) || rest.match(/^@(\w+)\s+(.+)/s);
            if (!match) throw new BadRequestException('Usage: -ANN_PRIVATE @username "message"');
            return { action: 'PRIVATE', targetValue: match[1], message: match[2].trim(), priority: 'PRIVATE', requiresAck, isEmergency, scheduledAt, recurrenceRule, raw: trimmed };
        }

        return null;
    }
}
