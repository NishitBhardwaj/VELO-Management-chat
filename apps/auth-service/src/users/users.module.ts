import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Device } from './entities/device.entity';
import { Connection } from './entities/connection.entity';
import { SocialLink } from './entities/social-link.entity';
import { UsersService } from './users.service';
import { ConnectionsService } from './connections.service';
import { UsersController } from './users.controller';

@Module({
    imports: [TypeOrmModule.forFeature([User, Device, Connection, SocialLink])],
    controllers: [UsersController],
    providers: [UsersService, ConnectionsService],
    exports: [UsersService, ConnectionsService],
})
export class UsersModule { }
