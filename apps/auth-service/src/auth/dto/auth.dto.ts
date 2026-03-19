import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    @IsNotEmpty()
    display_name: string;

    @IsOptional()
    @IsString()
    phone?: string;
}

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsOptional()
    @IsString()
    device_name?: string;

    @IsOptional()
    @IsString()
    platform?: string; // web | android
}

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    refresh_token: string;
}

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    display_name?: string;

    @IsOptional()
    @IsString()
    status_text?: string;

    @IsOptional()
    @IsString()
    avatar_url?: string;

    @IsOptional()
    @IsString()
    phone?: string;
}
