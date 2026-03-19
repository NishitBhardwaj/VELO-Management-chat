import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../entities';
import { RbacService } from './rbac.service';

@Module({
    imports: [TypeOrmModule.forFeature([Role])],
    providers: [RbacService],
    exports: [RbacService],
})
export class RbacModule { }
