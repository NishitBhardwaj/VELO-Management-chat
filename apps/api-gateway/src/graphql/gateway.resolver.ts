import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import axios from 'axios';
import { AuthResponseContext, LoginInput, RegisterInput, AttendanceCommand, BroadcastCommand } from './dto.models';

const SERVICES = {
    AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    HR: process.env.HR_SERVICE_URL || 'http://localhost:3003',
    BROADCAST: process.env.BROADCAST_SERVICE_URL || 'http://localhost:3005',
};

@Resolver()
export class GatewayResolver {

    // ─── Health ────────────────────────────────────
    @Query(() => String)
    ping(): string {
        return 'API Gateway GraphQL is Online ✅';
    }

    // ─── System 1: Auth Service Proxy ──────────────
    @Mutation(() => AuthResponseContext)
    async login(@Args('input') input: LoginInput): Promise<AuthResponseContext> {
        try {
            const res = await axios.post(`${SERVICES.AUTH}/auth/login`, input);
            return res.data;
        } catch (err: any) {
            throw new HttpException(err.response?.data?.message || 'Login failed', err.response?.status || 500);
        }
    }

    @Mutation(() => AuthResponseContext)
    async register(@Args('input') input: RegisterInput): Promise<AuthResponseContext> {
        try {
            console.log('[Gateway] Proxying register to Auth Service:', JSON.stringify(input));
            const res = await axios.post(`${SERVICES.AUTH}/auth/register`, input);
            console.log('[Gateway] Auth Service responded:', JSON.stringify(res.data));
            return res.data;
        } catch (err: any) {
            const msg = err.response?.data?.message;
            const status = err.response?.status || 500;
            const errorMessage = Array.isArray(msg) ? msg.join(', ') : (msg || 'Register failed');
            console.error('[Gateway] Auth register error:', status, errorMessage);
            throw new HttpException(errorMessage, status);
        }
    }

    // ─── System 3: HR Attendance ───────────────────
    @UseGuards(AuthGuard)
    @Mutation(() => String)
    async markAttendance(
        @Args('input') input: AttendanceCommand,
        @Context() context: any
    ): Promise<string> {
        try {
            const req = context.req;
            const res = await axios.post(
                `${SERVICES.HR}/hr/command`,
                {
                    message: input.message,
                    sender_id: req.user.id,
                    sender_role: req.user.role,
                },
                { headers: { Authorization: req.headers.authorization } }
            );
            return res.data.message || 'Attendance executed';
        } catch (err: any) {
            throw new HttpException(err.response?.data?.message || 'HR command failed', err.response?.status || 500);
        }
    }

    // ─── System 5: Broadcast ───────────────────────
    @UseGuards(AuthGuard)
    @Mutation(() => String)
    async sendBroadcast(
        @Args('input') input: BroadcastCommand,
        @Context() context: any
    ): Promise<string> {
        try {
            const req = context.req;
            const res = await axios.post(
                `${SERVICES.BROADCAST}/broadcast/command`,
                {
                    message: input.message,
                    sender_id: req.user.id,
                    sender_role: req.user.role,
                },
                { headers: { Authorization: req.headers.authorization } }
            );
            return res.data.message || 'Broadcast queued';
        } catch (err: any) {
            throw new HttpException(err.response?.data?.message || 'Broadcast failed', err.response?.status || 500);
        }
    }
}
