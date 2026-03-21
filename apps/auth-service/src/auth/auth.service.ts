import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto';

export interface JwtPayload {
    sub: string; // user ID
    email: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    user: {
        id: string;
        email: string;
        display_name: string;
        avatar_url: string | null;
    };
}

@Injectable()
export class AuthService {
    // In-memory OTP store: email → { otp, expiresAt }
    private otpStore = new Map<string, { otp: string; expiresAt: number }>();

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    // ─── Register ─────────────────────────────────────────

    async register(dto: RegisterDto): Promise<AuthTokens> {
        // Check if email already exists
        const existingEmail = await this.usersService.findByEmail(dto.email);
        if (existingEmail) {
            throw new ConflictException('Email already registered');
        }

        // Check if username already exists
        const existingUsername = await this.usersService.findByUsername(dto.username);
        if (existingUsername) {
            throw new ConflictException('Username already taken');
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(dto.password, salt);

        // Create user
        const user = await this.usersService.createUser({
            email: dto.email,
            username: dto.username,
            display_name: dto.display_name,
            phone: dto.phone,
            password_hash,
        });

        // Generate tokens
        return this.generateTokens(user.id, user.email, user.display_name, user.avatar_url);
    }

    // ─── Login ────────────────────────────────────────────

    async login(dto: LoginDto): Promise<AuthTokens> {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user || !user.password_hash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isValid = await bcrypt.compare(dto.password, user.password_hash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Register device if provided
        if (dto.device_name || dto.platform) {
            await this.usersService.registerDevice(
                user.id,
                dto.device_name || 'Unknown',
                dto.platform || 'web',
            );
        }

        return this.generateTokens(user.id, user.email, user.display_name, user.avatar_url);
    }

    // ─── Refresh ──────────────────────────────────────────

    async refresh(refreshToken: string): Promise<AuthTokens> {
        try {
            const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
                secret: process.env.JWT_SECRET || 'velo-jwt-secret-change-in-production',
            });

            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            return this.generateTokens(user.id, user.email, user.display_name, user.avatar_url);
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    // ─── Validate User (for JWT Strategy) ─────────────────

    async validateUser(userId: string) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    // ─── GOOGLE OAUTH ─────────────────────────────────────
    async validateOAuthLogin(profile: any): Promise<any> {
        try {
            // Check if user already exists
            let user = await this.usersService.findByEmail(profile.email);

            if (!user) {
                // Instantly create user without password
                user = await this.usersService.createUser({
                    email: profile.email,
                    display_name: `${profile.firstName} ${profile.lastName}`.trim() || profile.email.split('@')[0],
                    phone: null,
                    password_hash: '', // No password for OAuth users
                    avatar_url: profile.picture || null,
                    google_access_token: profile.accessToken || null,
                    google_refresh_token: profile.refreshToken || null,
                } as any);
            } else {
                // Update tokens for existing user
                const updateData: any = {
                    google_access_token: profile.accessToken,
                };
                if (profile.refreshToken) {
                    updateData.google_refresh_token = profile.refreshToken;
                }
                if (profile.picture && !user.avatar_url) {
                    updateData.avatar_url = profile.picture;
                }
                await this.usersService.updateProfile(user.id, updateData);
                user = await this.usersService.findById(user.id);
            }

            return user;
        } catch (error) {
            console.error('Error validating OAuth login', error);
            throw error;
        }
    }

    // ─── Token Generation ─────────────────────────────────

    public generateTokens(
        userId: string,
        email: string,
        displayName: string,
        avatarUrl: string | null,
    ): AuthTokens {
        const payload: JwtPayload = { sub: userId, email };

        const access_token = this.jwtService.sign(payload, {
            expiresIn: '1h',
        });

        const refresh_token = this.jwtService.sign(payload, {
            expiresIn: '30d',
        });

        return {
            access_token,
            refresh_token,
            user: {
                id: userId,
                email,
                display_name: displayName,
                avatar_url: avatarUrl,
            },
        };
    }

    // ─── Forgot Password (OTP) ────────────────────────────

    async forgotPassword(email: string): Promise<{ otp: string; message: string }> {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new NotFoundException('No account found with this email');
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store with 5-minute expiry
        this.otpStore.set(email.toLowerCase(), {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });

        console.log(`🔑 OTP for ${email}: ${otp}`);

        return {
            otp, // Returned directly for dev — show as browser notification
            message: 'OTP generated successfully. Valid for 5 minutes.',
        };
    }

    // ─── Reset Password ───────────────────────────────────

    async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
        const stored = this.otpStore.get(email.toLowerCase());

        if (!stored) {
            throw new BadRequestException('No OTP was requested for this email. Please request a new one.');
        }

        if (Date.now() > stored.expiresAt) {
            this.otpStore.delete(email.toLowerCase());
            throw new BadRequestException('OTP has expired. Please request a new one.');
        }

        if (stored.otp !== otp) {
            throw new BadRequestException('Invalid OTP. Please try again.');
        }

        // OTP is valid — update password
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(newPassword, salt);
        await this.usersService.updateProfile(user.id, { password_hash } as any);

        // Clean up OTP
        this.otpStore.delete(email.toLowerCase());

        return { message: 'Password reset successfully. You can now login with your new password.' };
    }
}
