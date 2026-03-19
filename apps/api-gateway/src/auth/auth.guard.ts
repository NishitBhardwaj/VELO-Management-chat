import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const ctx = GqlExecutionContext.create(context);
        const request = ctx.getContext().req;

        // For REST fallback if needed
        const req = request || context.switchToHttp().getRequest();

        if (!req.headers.authorization) {
            throw new UnauthorizedException('Authentication token missing');
        }

        const token = req.headers.authorization.split(' ')[1];
        if (!token) throw new UnauthorizedException('Malformed token');

        try {
            const secret = process.env.JWT_SECRET || 'velo_super_secret_dev_key';
            const decoded = jwt.verify(token, secret);
            req.user = decoded; // Attach payload: { id, phone, role }
            return true;
        } catch (err) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
