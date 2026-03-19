import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { DirectMessage } from './direct-message.entity';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([DirectMessage]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'velo-jwt-secret-change-in-production',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
    exports: [ChatService],
})
export class ChatModule {}
