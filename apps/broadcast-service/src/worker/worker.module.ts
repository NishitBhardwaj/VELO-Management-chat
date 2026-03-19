import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BroadcastMessage, BroadcastDeliveryLog, UserStub } from '../entities';
import { FanoutWorker } from './fanout.worker';

@Module({
    imports: [TypeOrmModule.forFeature([BroadcastMessage, BroadcastDeliveryLog, UserStub])],
    providers: [FanoutWorker],
})
export class WorkerModule { }
