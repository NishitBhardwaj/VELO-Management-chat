import { Controller, Get, Post, Put, Query, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectionStatus } from './entities/connection.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private usersService: UsersService,
        private connectionsService: ConnectionsService,
    ) {}

    @Get('search')
    async searchUser(@Query('email') email: string, @Request() req) {
        if (!email) {
            throw new BadRequestException('Email query parameter is required');
        }
        
        if (email.toLowerCase() === req.user.email.toLowerCase()) {
            throw new BadRequestException('Cannot search for your own email');
        }

        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return { found: false };
        }

        return {
            found: true,
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            status_text: user.status_text,
        };
    }

    @Post('connections')
    async sendConnectionRequest(@Request() req, @Body('recipientId') recipientId: string) {
        if (!recipientId) {
            throw new BadRequestException('recipientId is required');
        }
        return this.connectionsService.sendRequest(req.user.id, recipientId);
    }

    @Get('connections/pending')
    async getPendingRequests(@Request() req) {
        const pending = await this.connectionsService.getPendingRequests(req.user.id);
        return pending.map(conn => ({
            id: conn.id,
            requester: {
                id: conn.requester.id,
                email: conn.requester.email,
                display_name: conn.requester.display_name,
                avatar_url: conn.requester.avatar_url,
            },
            status: conn.status,
            created_at: conn.created_at,
        }));
    }

    @Get('contacts')
    async getAcceptedContacts(@Request() req) {
        const contacts = await this.connectionsService.getAcceptedContacts(req.user.id);
        return contacts.map(c => ({
            id: c.id,
            email: c.email,
            display_name: c.display_name,
            avatar_url: c.avatar_url,
            status_text: c.status_text,
        }));
    }

    @Put('connections/:id')
    async respondToRequest(
        @Request() req,
        @Param('id') connectionId: string,
        @Body('status') status: ConnectionStatus
    ) {
        if (status !== ConnectionStatus.ACCEPTED && status !== ConnectionStatus.REJECTED) {
            throw new BadRequestException('Invalid status. Must be ACCEPTED or REJECTED.');
        }
        return this.connectionsService.respondToRequest(req.user.id, connectionId, status);
    }
}
