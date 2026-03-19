import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    // PostgreSQL connection
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      username: process.env.POSTGRES_USER || 'velo',
      password: process.env.POSTGRES_PASSWORD || 'velo_dev_2026',
      database: process.env.POSTGRES_DB || 'velo_db',
      autoLoadEntities: true,
      synchronize: true, // Auto-sync schema in development
    }),

    AuthModule,
    UsersModule,
    ChatModule,
  ],
})
export class AppModule { }
