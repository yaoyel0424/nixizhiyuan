import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants/error-code.constant';
import { DateUtil } from '../utils/date.util';
import { LoggerUtil } from '../utils/logger.util';

/**
 * 全局异常过滤器
 * 捕获所有未处理的异常
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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
        (exceptionResponse as any)?.errorCode ||
        this.getErrorCodeByStatus(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      LoggerUtil.error(
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
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_SERVER_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }
}

