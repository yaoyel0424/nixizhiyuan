import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ErrorCode } from '../constants/error-code.constant';

/**
 * 数据验证管道
 * 使用 class-validator 验证 DTO
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (value == null || !metatype || !this.toValidate(metatype, value)) {
      return value;
    }

    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true, // 启用隐式转换，使 @Transform 装饰器生效
    });
    const errors = await validate(object, {
      whitelist: true, // 移除未定义的属性
      forbidNonWhitelisted: true, // 禁止未定义的属性
      transform: true, // 自动转换类型
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        return {
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        };
      });

      throw new BadRequestException({
        success: false,
        code: ErrorCode.VALIDATION_ERROR,
        message: '数据验证失败',
        errors: errorMessages,
      });
    }

    return object;
  }

  /**
   * 检查是否需要验证
   * 不校验基本类型及 User（请求上下文的当前用户，形状可能与实体不一致，避免 @CurrentUser() 触发校验失败）
   */
  private toValidate(metatype: any, value?: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    if (types.includes(metatype)) return false;
    if (metatype?.name === 'User') return false;
    // 当前用户对象：通常带 id 且带 openid/username/email 等，不当作 DTO 校验
    if (value && typeof value === 'object' && 'id' in value && ('openid' in value || 'username' in value || 'email' in value)) {
      return false;
    }
    return true;
  }
}

