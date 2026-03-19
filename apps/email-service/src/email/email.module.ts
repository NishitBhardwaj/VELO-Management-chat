import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailMetadata, EmailAuditLog } from '../entities';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailClassifier } from './email-classifier.service';
import { OAuthModule } from '../oauth/oauth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmailMetadata, EmailAuditLog]),
        OAuthModule,
    ],
    controllers: [EmailController],
    providers: [EmailService, EmailClassifier],
})
export class EmailModule { }
