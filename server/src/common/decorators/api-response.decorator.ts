import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiResponseOptions } from '@nestjs/swagger';

/**
 * API 响应装饰器
 * 用于统一 API 响应格式的 Swagger 文档
 * @param options 响应选项
 */
export const ApiResponseDecorator = (options?: ApiResponseOptions) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: '操作成功',
      ...options,
    }),
  );
};

