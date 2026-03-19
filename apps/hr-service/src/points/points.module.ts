import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransaction, PointsBalance, HrAuditLog } from '../entities';
import { PointsService } from './points.service';

@Module({
    imports: [TypeOrmModule.forFeature([PointsTransaction, PointsBalance, HrAuditLog])],
    providers: [PointsService],
    exports: [PointsService],
})
export class PointsModule { }
