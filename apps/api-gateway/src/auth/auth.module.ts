import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

/**
 * Authentication Module for the API Gateway.
 * It's lightweight because the heavy lifting (login, register, token generation)
 * is done by the actual Auth Service `:3001`.
 * 
 * The Gateway only verifies the JWT signature to protect downstream microservices.
 */
@Module({
    providers: [AuthGuard],
    exports: [AuthGuard]
})
export class AuthModule { }
