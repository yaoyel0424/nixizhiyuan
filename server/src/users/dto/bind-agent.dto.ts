import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsIn } from 'class-validator';

/**
 * 通过代理商 uuid 绑定当前用户到该代理商
 */
export class BindAgentDto {
  @ApiProperty({ description: '代理商 UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsUUID('4', { message: 'uuid 格式不正确' })
  uuid: string;

  @ApiPropertyOptional({ description: '绑定来源：scan=扫码进入，share_link=分享链接进入', enum: ['scan', 'share_link'] })
  @IsOptional()
  @IsString()
  @IsIn(['scan', 'share_link'], { message: 'from 仅支持 scan 或 share_link' })
  from?: 'scan' | 'share_link';
}
