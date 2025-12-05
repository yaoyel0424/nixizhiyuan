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
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // 移除未定义的属性
      forbidNonWhitelisted: true, // 禁止未定义的属性
      transform: true, // 自动转换类型
    });

    console.log(errors);
    console.log(metatype);
    console.log(value);
    console.log(object);

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
   */
  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}

