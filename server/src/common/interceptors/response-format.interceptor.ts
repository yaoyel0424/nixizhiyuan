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
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // 检查响应是否已经被手动处理（例如使用 @Res() 装饰器）
    // 如果响应头已经设置，说明是手动处理的响应（如PDF文件），跳过格式化
    if (response.headersSent || response.getHeader('Content-Type') === 'application/pdf') {
      return next.handle() as Observable<IResponse<T>>;
    }
    
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

