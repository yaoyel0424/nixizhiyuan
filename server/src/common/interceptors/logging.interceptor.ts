import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { Logger } from '@nestjs/common';

/**
 * 日志拦截器
 * 记录请求日志，包括请求路径、方法、参数、响应时间
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, body, query, params } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${ip} - ${responseTime}ms`,
            'LoggingInterceptor',
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${ip} - ${responseTime}ms - Error: ${error.message}`,
            error.stack,
            'LoggingInterceptor',
          );
        },
      }),
    );
  }
}

