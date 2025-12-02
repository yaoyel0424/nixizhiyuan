import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants/error-code.constant';
import { DateUtil } from '../utils/date.util';
import { LoggerService } from '../../logger/logger.service';

/**
 * 全局异常过滤器
 * 捕获所有未处理的异常
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = ErrorCode.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message || exception.message;
      code =
        (exceptionResponse as any)?.code ||
        (exceptionResponse as any)?.errorCode ||
        this.getErrorCodeByStatus(status);

      // 记录 HTTP 异常日志（4xx 和 5xx 错误）
      if (status >= 400) {
        // 构建日志消息，包含请求 body
        const bodyStr = request.body
          ? JSON.stringify(request.body)
          : 'null';
        const logMessage = `HTTP ${status} ${request.method} ${request.url} - ${message} (code: ${code}) | body: ${bodyStr}`;
        
        if (status >= 500) {
          this.logger.error(logMessage, undefined, 'AllExceptionsFilter');
        } else {
          this.logger.warn(logMessage, 'AllExceptionsFilter');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `未处理的异常: ${exception.message}`,
        exception.stack,
        'AllExceptionsFilter',
      );
    }

    const errorResponse = {
      success: false,
      code,
      message,
      timestamp: DateUtil.getCurrentTimestamp(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  /**
   * 根据 HTTP 状态码获取错误码
   */
  private getErrorCodeByStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.OPERATION_FAILED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_SERVER_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }
}

