import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CassandraModule } from './cassandra/cassandra.module';
import { ChatRouter } from './chat/chat.router';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    CassandraModule,
  ],
  providers: [ChatRouter],
})
export class AppModule { }
