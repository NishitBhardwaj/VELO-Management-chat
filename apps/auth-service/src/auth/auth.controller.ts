import {
    Controller,
    Post,
    Get,
    Put,
    Body,
    UseGuards,
    Request,
    Res,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto } from './dto';
import { JwtAuthGuard } from './guards';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) { }

    // ─── POST /auth/register ──────────────────────────────
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // ─── POST /auth/login ─────────────────────────────────
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    // ─── GET /auth/google ─────────────────────────────────
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // Initiates the Google OAuth flow
    }

    // ─── GET /auth/google/callback ────────────────────────
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    googleAuthRedirect(@Request() req, @Res() res) {
        // req.user contains the validated user from GoogleStrategy
        // We generate a JWT for our system and redirect to frontend
        const tokenData = this.authService.generateTokens(
            req.user.id,
            req.user.email,
            req.user.display_name,
            req.user.avatar_url,
        );

        // Redirect back to frontend with the token
        return res.redirect(`http://localhost:5173/auth/callback?token=${tokenData.access_token}`);
    }

    // ─── POST /auth/refresh ───────────────────────────────
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto.refresh_token);
    }

    // ─── GET /auth/me ─────────────────────────────────────
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req: any) {
        const user = await this.usersService.findById(req.user.id);
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
        };
    }

    // ─── PUT /auth/profile ────────────────────────────────
    @Put('profile')
    @UseGuards(JwtAuthGuard)
    async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
        const updated = await this.usersService.updateProfile(req.user.id, dto);
        return {
            id: updated.id,
            email: updated.email,
            display_name: updated.display_name,
            avatar_url: updated.avatar_url,
            status_text: updated.status_text,
        };
    }

    // ─── POST /auth/forgot-password ───────────────────────
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body('email') email: string) {
        if (!email) {
            throw new BadRequestException('Email is required');
        }
        return this.authService.forgotPassword(email);
    }

    // ─── POST /auth/reset-password ────────────────────────
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(
        @Body('email') email: string,
        @Body('otp') otp: string,
        @Body('newPassword') newPassword: string,
    ) {
        if (!email || !otp || !newPassword) {
            throw new BadRequestException('Email, OTP, and newPassword are required');
        }
        if (newPassword.length < 6) {
            throw new BadRequestException('Password must be at least 6 characters');
        }
        return this.authService.resetPassword(email, otp, newPassword);
    }

    // ─── GET /auth/health ─────────────────────────────────
    @Get('health')
    health() {
        return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
    }
}
