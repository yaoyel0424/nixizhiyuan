import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { APP_CONSTANTS } from '../../common/constants/app.constant';

/**
 * 查询专业收藏列表 DTO（分页）
 */
export class QueryMajorFavoriteDto {
  /**
   * 页码
   */
  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
    default: APP_CONSTANTS.DEFAULT_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = APP_CONSTANTS.DEFAULT_PAGE;

  /**
   * 每页数量
   */
  @ApiProperty({
    description: '每页数量',
    example: 10,
    required: false,
    default: APP_CONSTANTS.DEFAULT_LIMIT,
    maximum: APP_CONSTANTS.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(APP_CONSTANTS.MAX_LIMIT)
  limit?: number = APP_CONSTANTS.DEFAULT_LIMIT;
}

