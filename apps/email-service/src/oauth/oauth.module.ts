import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConnection, EmailAuditLog } from '../entities';
import { OAuthService } from './oauth.service';

@Module({
    imports: [TypeOrmModule.forFeature([EmailConnection, EmailAuditLog])],
    providers: [OAuthService],
    exports: [OAuthService],
})
export class OAuthModule { }
