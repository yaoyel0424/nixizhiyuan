import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { LoggerService } from '@/logger/logger.service';

/**
 * 日志拦截器
 * 使用 LoggerService 记录请求日志（会写入 logs/app.log），包含路径、方法、userId、响应时间
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    // 与 IpBlockGuard / RateLimitGuard 一致：优先 X-Forwarded-For、X-Real-IP，否则为代理内网 IP
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown';
    const userId = (request as any).user?.id;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const userPart = userId != null ? ` userId=${userId}` : '';
          this.logger.log(
            `${method} ${url} ${ip}${userPart} - ${responseTime}ms`,
            'LoggingInterceptor',
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const userPart = userId != null ? ` userId=${userId}` : '';
          this.logger.error(
            `${method} ${url} ${ip}${userPart} - ${responseTime}ms - Error: ${error.message}`,
            error.stack,
            'LoggingInterceptor',
          );
        },
      }),
    );
  }
}

