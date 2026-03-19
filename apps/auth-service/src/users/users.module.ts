import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Device, Connection } from './entities';
import { UsersService } from './users.service';
import { ConnectionsService } from './connections.service';
import { UsersController } from './users.controller';

@Module({
    imports: [TypeOrmModule.forFeature([User, Device, Connection])],
    controllers: [UsersController],
    providers: [UsersService, ConnectionsService],
    exports: [UsersService, ConnectionsService],
})
export class UsersModule { }
