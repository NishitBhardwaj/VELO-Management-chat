import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BroadcastModule } from './broadcast/broadcast.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      username: process.env.POSTGRES_USER || 'velo',
      password: process.env.POSTGRES_PASSWORD || 'velo_dev_2026',
      database: process.env.POSTGRES_DB || 'velo_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    BroadcastModule,
    WorkerModule,
  ],
})
export class AppModule { }
