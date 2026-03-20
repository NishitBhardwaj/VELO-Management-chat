import { Controller, Get, Post, Put, Delete, Query, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectionStatus } from './entities/connection.entity';
import { SocialLink } from './entities/social-link.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private usersService: UsersService,
        private connectionsService: ConnectionsService,
        @InjectRepository(SocialLink)
        private socialLinkRepo: Repository<SocialLink>,
    ) {}

    @Get('search')
    async searchUser(@Query('username') username: string, @Request() req) {
        if (!username) {
            throw new BadRequestException('Username query parameter is required');
        }

        const user = await this.usersService.findByUsername(username);
        if (!user) {
            return { found: false };
        }

        if (user.id === req.user.id) {
            throw new BadRequestException('Cannot search for yourself');
        }

        return {
            found: true,
            id: user.id,
            username: user.username,
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

    // ─── Profile with Social Links ─────────────────────────

    @Get('profile/full')
    async getFullProfile(@Request() req) {
        const user = await this.usersService.findById(req.user.id);
        const links = await this.socialLinkRepo.find({
            where: { user_id: req.user.id },
            order: { created_at: 'ASC' },
        });

        return {
            id: user?.id,
            email: user?.email,
            display_name: user?.display_name,
            avatar_url: user?.avatar_url,
            status_text: user?.status_text,
            phone: user?.phone,
            organization: user?.organization,
            position: user?.position,
            bio: user?.bio,
            social_links: links.map(l => ({
                id: l.id,
                label: l.label,
                url: l.url,
            })),
        };
    }

    @Get('profile/links')
    async getSocialLinks(@Request() req) {
        const links = await this.socialLinkRepo.find({
            where: { user_id: req.user.id },
            order: { created_at: 'ASC' },
        });
        return links.map(l => ({ id: l.id, label: l.label, url: l.url }));
    }

    @Post('profile/links')
    async addSocialLink(
        @Request() req,
        @Body('label') label: string,
        @Body('url') url: string,
    ) {
        if (!label || !url) {
            throw new BadRequestException('label and url are required');
        }
        const link = this.socialLinkRepo.create({
            user_id: req.user.id,
            label: label.trim(),
            url: url.trim(),
        });
        const saved = await this.socialLinkRepo.save(link);
        return { id: saved.id, label: saved.label, url: saved.url };
    }

    @Delete('profile/links/:id')
    async deleteSocialLink(@Request() req, @Param('id') linkId: string) {
        const link = await this.socialLinkRepo.findOne({ where: { id: linkId, user_id: req.user.id } });
        if (!link) {
            throw new BadRequestException('Link not found');
        }
        await this.socialLinkRepo.remove(link);
        return { message: 'Link deleted' };
    }
}
