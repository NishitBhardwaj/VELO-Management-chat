import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ProcessingModule } from '../processing/processing.module';

@Module({
    imports: [ProcessingModule],
    controllers: [UploadController],
})
export class UploadModule { }
