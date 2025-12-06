import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建省份收藏 DTO
 */
export class CreateProvinceFavoriteDto {
  /**
   * 省份ID
   */
  @ApiProperty({
    description: '省份ID',
    example: 11,
  })
  @IsInt({ message: '省份ID必须是整数' })
  @IsNotEmpty({ message: '省份ID不能为空' })
  @Min(1, { message: '省份ID必须大于0' })
  provinceId: number;
}

