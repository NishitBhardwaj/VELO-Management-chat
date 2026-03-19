import { Injectable, BadRequestException } from '@nestjs/common';

// ─── Parsed Command Types ────────────────────────────────

export type CommandAction =
    | 'PRESENT'
    | 'ABSENT'
    | 'FIRST_HALF_DAY'
    | 'SECOND_HALF_DAY'
    | 'POINTS'
    | 'ANNOUNCE';

export interface ParsedCommand {
    action: CommandAction;
    targetUsername?: string;     // @username
    pointsValue?: number;       // ±N for -POI
    message?: string;           // "msg" for -ANN
    raw: string;
}

// ─── Command Map ─────────────────────────────────────────

const COMMAND_MAP: Record<string, CommandAction> = {
    '-P': 'PRESENT',
    '-A': 'ABSENT',
    '-FHD': 'FIRST_HALF_DAY',
    '-SHD': 'SECOND_HALF_DAY',
    '-POI': 'POINTS',
    '-ANN': 'ANNOUNCE',
};

// ─── Required RBAC Level per Action ──────────────────────

export const ACTION_MIN_ROLE: Record<CommandAction, string> = {
    PRESENT: 'team_leader',
    ABSENT: 'team_leader',
    FIRST_HALF_DAY: 'team_leader',
    SECOND_HALF_DAY: 'team_leader',
    POINTS: 'team_leader',
    ANNOUNCE: 'team_leader',
};

@Injectable()
export class CommandParserService {
    /**
     * Parse a raw chat message into a structured HR command.
     *
     * Grammar:
     *   ATTENDANCE := ("-P" | "-A" | "-FHD" | "-SHD") SPACE "@" USERNAME
     *   POINTS     := "-POI" SPACE SIGNED_INT SPACE "@" USERNAME
     *   ANNOUNCE   := "-ANN" SPACE QUOTED_STRING
     */
    parse(rawMessage: string): ParsedCommand | null {
        const trimmed = rawMessage.trim();

        // Must start with '-'
        if (!trimmed.startsWith('-')) return null;

        // Try to match a command — sort by prefix length DESC to avoid
        // "-P" matching before "-POI" or "-A" matching before "-ANN"
        const sortedEntries = Object.entries(COMMAND_MAP).sort(
            (a, b) => b[0].length - a[0].length,
        );

        for (const [prefix, action] of sortedEntries) {
            if (!trimmed.toUpperCase().startsWith(prefix.toUpperCase())) continue;

            const rest = trimmed.slice(prefix.length).trim();

            // ─── Attendance Commands: -P @user ──────────────
            if (['PRESENT', 'ABSENT', 'FIRST_HALF_DAY', 'SECOND_HALF_DAY'].includes(action)) {
                const match = rest.match(/^@(\w+)$/);
                if (!match) {
                    throw new BadRequestException(`Invalid syntax. Usage: ${prefix} @username`);
                }
                return { action, targetUsername: match[1], raw: trimmed };
            }

            // ─── Points: -POI ±N @user ──────────────────────
            if (action === 'POINTS') {
                const match = rest.match(/^([+-]?\d+)\s+@(\w+)$/);
                if (!match) {
                    throw new BadRequestException('Invalid syntax. Usage: -POI ±N @username');
                }
                return {
                    action,
                    pointsValue: parseInt(match[1]),
                    targetUsername: match[2],
                    raw: trimmed,
                };
            }

            // ─── Announce: -ANN "message" ───────────────────
            if (action === 'ANNOUNCE') {
                const match = rest.match(/^"(.+)"$/) || rest.match(/^'(.+)'$/) || rest.match(/^(.+)$/);
                if (!match || !match[1].trim()) {
                    throw new BadRequestException('Invalid syntax. Usage: -ANN "message"');
                }
                return { action, message: match[1].trim(), raw: trimmed };
            }
        }

        return null; // Not a recognized command
    }

    /**
     * Check if a message looks like a command (quick check without full parsing).
     */
    isCommand(message: string): boolean {
        return message.trim().startsWith('-');
    }
}
