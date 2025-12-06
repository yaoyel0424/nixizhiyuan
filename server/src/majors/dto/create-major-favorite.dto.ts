import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建专业收藏 DTO
 */
export class CreateMajorFavoriteDto {
  /**
   * 专业代码
   */
  @ApiProperty({
    description: '专业代码',
    example: '010101',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: '专业代码不能为空' })
  @MaxLength(10, { message: '专业代码长度不能超过10个字符' })
  majorCode: string;
}

