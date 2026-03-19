import { Module } from '@nestjs/common';
import { CommandParserService } from './command-parser.service';
import { CommandController } from './command.controller';
import { RbacModule } from '../rbac/rbac.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PointsModule } from '../points/points.module';

@Module({
    imports: [RbacModule, AttendanceModule, PointsModule],
    controllers: [CommandController],
    providers: [CommandParserService],
})
export class CommandModule { }
