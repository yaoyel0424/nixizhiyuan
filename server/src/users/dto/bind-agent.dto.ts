import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/**
 * 通过代理商 uuid 绑定当前用户到该代理商
 */
export class BindAgentDto {
  @ApiProperty({ description: '代理商 UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsUUID('4', { message: 'uuid 格式不正确' })
  uuid: string;
}
