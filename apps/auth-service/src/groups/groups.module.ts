import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupMeeting } from './entities/group-meeting.entity';
import { DirectMessage } from '../chat/direct-message.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Group, GroupMember, GroupMeeting, DirectMessage])],
    controllers: [GroupsController],
    providers: [GroupsService],
    exports: [GroupsService],
})
export class GroupsModule {}
