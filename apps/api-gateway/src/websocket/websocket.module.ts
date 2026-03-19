import { Module } from '@nestjs/common';
import { ChatWebsocketGateway } from './websocket.gateway';

@Module({
    providers: [ChatWebsocketGateway],
})
export class WebsocketModule { }
