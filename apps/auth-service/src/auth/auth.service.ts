import {
    Injectable,
    UnauthorizedException,
    ConflictException,
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
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    // ─── Register ─────────────────────────────────────────

    async register(dto: RegisterDto): Promise<AuthTokens> {
        // Check if email already exists
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(dto.password, salt);

        // Create user
        const user = await this.usersService.createUser({
            email: dto.email,
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
                });

                // Update avatar if available
                if (profile.picture) {
                    await this.usersService.updateProfile(user.id, { avatar_url: profile.picture });
                    user.avatar_url = profile.picture;
                }
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
}
