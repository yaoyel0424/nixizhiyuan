import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 更新用户昵称请求 DTO
 */
export class UpdateNicknameDto {
  /**
   * 用户昵称
   */
  @ApiProperty({
    description: '用户昵称',
    example: '小明',
  })
  @IsString({ message: '昵称必须是字符串' })
  @MinLength(1, { message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称最多 50 个字符' })
  nickname: string;
}

