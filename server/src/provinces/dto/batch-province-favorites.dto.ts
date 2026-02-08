import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 批量操作省份收藏 DTO（添加或取消）
 */
export class BatchProvinceFavoritesDto {
  @ApiProperty({
    description: '省份ID列表',
    example: [11, 12, 13],
    type: [Number],
    minItems: 1,
  })
  @IsArray({ message: 'provinceIds 必须是数组' })
  @ArrayMinSize(1, { message: 'provinceIds 至少包含一个省份ID' })
  @IsInt({ each: true, message: '每个省份ID必须是整数' })
  @Min(1, { each: true, message: '每个省份ID必须大于0' })
  @Type(() => Number)
  provinceIds: number[];
}
