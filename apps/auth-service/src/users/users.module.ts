import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Device } from './entities';
import { UsersService } from './users.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, Device])],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
