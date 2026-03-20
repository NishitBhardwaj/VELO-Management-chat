import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { DirectMessage } from './direct-message.entity';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { CommandParserService } from './command-parser.service';
import { GroupsModule } from '../groups/groups.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DirectMessage]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'velo-jwt-secret-change-in-production',
            signOptions: { expiresIn: '1h' },
        }),
        forwardRef(() => GroupsModule),
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, CommandParserService],
    exports: [ChatService],
})
export class ChatModule {}

