import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { APP_CONSTANTS } from '../constants/app.constant';

/**
 * 超时拦截器
 * 处理请求超时
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(APP_CONSTANTS.REQUEST_TIMEOUT),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('请求超时，请稍后重试'),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

