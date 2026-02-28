import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 创建代理商 DTO
 * 不传 openId；分账比例默认 30%
 */
export class CreateAgentDto {
  @ApiProperty({
    description: '类型：personal 个人 / store 商铺',
    enum: ['personal', 'store'],
    example: 'personal',
  })
  @IsString()
  @IsIn(['personal', 'store'], { message: '类型只能是 personal 或 store' })
  type: 'personal' | 'store';

  @ApiPropertyOptional({
    description: '姓名或商铺名称（可选，可为 null）',
    example: '张三',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '姓名或商铺名称长度不能超过100' })
  name?: string | null;

  @ApiPropertyOptional({
    description: '联系电话',
    example: '13800138000',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '联系电话长度不能超过32' })
  phone?: string | null; 
 
  @ApiPropertyOptional({
    description: '商铺代理的微信商户号（type=store 时可传）',
    example: '1234567890',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: '商户号长度不能超过32' })
  merchantId?: string | null;
}
