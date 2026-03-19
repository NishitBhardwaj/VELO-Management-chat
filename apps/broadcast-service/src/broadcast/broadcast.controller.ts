import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { CommandParserService } from './command-parser.service';

@Controller('broadcast')
export class BroadcastController {
    constructor(
        private readonly broadcastService: BroadcastService,
        private readonly parser: CommandParserService,
    ) { }

    @Get('health')
    health() {
        return { status: 'ok', service: 'broadcast-service' };
    }

    @Post('command')
    @HttpCode(HttpStatus.OK)
    async handleCommand(
        @Body() body: { message: string; sender_id: string; sender_role: string },
    ) {
        const { message, sender_id, sender_role } = body;
        const result = await this.broadcastService.executeBroadcastCommand(
            message,
            sender_id,
            sender_role || 'hr' // Fallback to HR in local dev tests if missing
        );
        return result;
    }

    @Get('stats/:id')
    async getStats(@Param('id') id: string) {
        return this.broadcastService.getBroadcastStats(id);
    }

    @Post('ack')
    @HttpCode(HttpStatus.OK)
    async acknowledge(
        @Body() body: { user_id: string; broadcast_id: string },
    ) {
        return this.broadcastService.acknowledgeBroadcast(body.user_id, body.broadcast_id);
    }

    @Get('stats/:id/export')
    async exportCsv(@Param('id') id: string) {
        return this.broadcastService.exportBroadcastAnalytics(id);
    }

    @Post('parse-test')
    parseTest(@Body() body: { message: string }) {
        return { input: body.message, parsed: this.parser.parse(body.message) };
    }
}
