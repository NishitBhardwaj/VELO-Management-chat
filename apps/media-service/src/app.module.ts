import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module';
import { UploadModule } from './upload/upload.module';
import { ProcessingModule } from './processing/processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    StorageModule,
    UploadModule,
    ProcessingModule,
  ],
})
export class AppModule { }
