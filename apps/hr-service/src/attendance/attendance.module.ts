import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord, HrAuditLog } from '../entities';
import { AttendanceService } from './attendance.service';

@Module({
    imports: [TypeOrmModule.forFeature([AttendanceRecord, HrAuditLog])],
    providers: [AttendanceService],
    exports: [AttendanceService],
})
export class AttendanceModule { }
