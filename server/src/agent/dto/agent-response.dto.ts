import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

/**
 * 代理商响应 DTO
 */
@Exclude()
export class AgentResponseDto {
  @ApiProperty({ description: '代理商主键' })
  @Expose()
  id: number;

  @ApiProperty({ description: '类型：personal 个人 / store 商铺' })
  @Expose()
  type: string;

  @ApiProperty({ description: '姓名或商铺名称' })
  @Expose()
  name: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @Expose()
  phone: string | null;

  @ApiPropertyOptional({ description: '个人代理的微信 openid' })
  @Expose()
  openid: string | null;

  @ApiPropertyOptional({ description: '商铺代理的微信商户号' })
  @Expose()
  merchantId: string | null;

  @ApiProperty({ description: '分账比例，如 0.3 表示 30%' })
  @Expose()
  splitRatio: number;

  @ApiProperty({ description: '状态：active 启用 / inactive 禁用' })
  @Expose()
  status: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  updatedAt: Date;
}
