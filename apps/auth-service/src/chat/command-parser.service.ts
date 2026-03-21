import { Injectable } from '@nestjs/common';

export interface CommandExtraction {
    identifier: string; // The username or email
    command: string; // The raw command flag (e.g. -P)
    status: 'Present' | 'Absent' | 'First Half Day' | 'Second Half Day' | 'Leave Applied';
}

@Injectable()
export class CommandParserService {
    // Recognized flags
    private commandMap = {
        '-P': 'Present',
        '-A': 'Absent',
        '-FHD': 'First Half Day',
        '-SHD': 'Second Half Day',
        '-LA': 'Leave Applied',
    };

    /**
     * Parses a chat string for structured commands.
     * Looks for occurrences of @username -X or @email -X
     */
    public extractCommands(text: string): CommandExtraction[] {
        const results: CommandExtraction[] = [];
        // Regex exactly matching: @ followed by an identifier (alphanumerics, period, hyphen, or email syntax)
        // followed by one or more spaces, followed by a supported command token loosely cased.
        const regex = /@([\w.-]+(?:@[\w.-]+\.\w+)?)\s+(-[a-zA-Z]+)/g;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            const identifier = match[1];
            const rawFlag = match[2];
            
            // Normalize flag to uppercase for dictionary lookup
            const normalizedFlag = rawFlag.toUpperCase();
            
            if (this.commandMap[normalizedFlag]) {
                results.push({
                    identifier,
                    command: rawFlag,
                    status: this.commandMap[normalizedFlag] as any,
                });
            }
        }
        return results;
    }

    public hasAiRequest(text: string): boolean {
        return text?.includes('@velo-bot') || false;
    }
}
