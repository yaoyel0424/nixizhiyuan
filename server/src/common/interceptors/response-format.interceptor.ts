import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ErrorCode } from '../constants/error-code.constant';
import { DateUtil } from '../utils/date.util';
import { IResponse } from '../interfaces/response.interface';

/**
 * 响应格式统一拦截器
 * 将响应包装成标准格式 {success, code, message, data, timestamp}
 */
@Injectable()
export class ResponseFormatInterceptor<T>
  implements NestInterceptor<T, IResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<IResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        // 如果已经是标准格式，直接返回
        if (data && typeof data === 'object' && 'success' in data) {
          return data as IResponse<T>;
        }

        // 包装成标准格式
        return {
          success: true,
          code: ErrorCode.SUCCESS,
          message: '操作成功',
          data: data as T,
          timestamp: DateUtil.getCurrentTimestamp(),
        };
      }),
    );
  }
}

