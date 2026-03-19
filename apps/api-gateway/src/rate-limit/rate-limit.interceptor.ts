import { Injectable, CallHandler, ExecutionContext, NestInterceptor, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
// removed
import Redis from 'ioredis';

// Note: Using a standard dependency injection in the module, 
// let's just create a custom direct Redis connection for the limiter 
// to avoid extra nestjs packages configuration bloat if possible.
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const ctx = GqlExecutionContext.create(context);
        const req = ctx.getContext().req || context.switchToHttp().getRequest();

        // Fallback to IP if user isn't authenticated yet
        const identifier = req.user ? req.user.id : (req.ip || 'anonymous');

        // Rolling window rate limit: 100 requests per minute
        const limit = 100;
        const windowSec = 60;
        const key = `rate-limit:${identifier}`;

        const currentCount = await this.redis.incr(key);

        if (currentCount === 1) {
            await this.redis.expire(key, windowSec);
        }

        if (currentCount > limit) {
            throw new HttpException('Too Many Requests. Max 100/min.', HttpStatus.TOO_MANY_REQUESTS);
        }

        return next.handle();
    }
}
