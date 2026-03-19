import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BroadcastMessage, BroadcastAuditLog } from '../entities';
import { BroadcastService } from './broadcast.service';
import { CommandParserService } from './command-parser.service';
import { BroadcastController } from './broadcast.controller';

@Module({
    imports: [TypeOrmModule.forFeature([BroadcastMessage, BroadcastAuditLog])],
    controllers: [BroadcastController],
    providers: [BroadcastService, CommandParserService],
    exports: [BroadcastService],
})
export class BroadcastModule { }
