import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 微信登录 DTO
 */
export class WechatLoginDto {
  @ApiProperty({
    description: '微信授权码（code）',
    example: '081abc123def456',
  })
  @IsString()
  @IsNotEmpty({ message: '微信授权码不能为空' })
  code: string;
}

