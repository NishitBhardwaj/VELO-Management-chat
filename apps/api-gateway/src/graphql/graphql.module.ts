import { Module } from '@nestjs/common';
import { GatewayResolver } from './gateway.resolver';

@Module({
    providers: [GatewayResolver],
})
export class GraphqlProxyModule { }
