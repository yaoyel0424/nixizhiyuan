import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 专业收藏响应 DTO
 */
export class MajorFavoriteResponseDto {
  /**
   * 收藏记录ID
   */
  @ApiProperty({ description: '收藏记录ID', example: 1 })
  @Expose()
  id: number;

  /**
   * 用户ID
   */
  @ApiProperty({ description: '用户ID', example: 1 })
  @Expose()
  userId: number;

  /**
   * 专业代码
   */
  @ApiProperty({ description: '专业代码', example: '010101' })
  @Expose()
  majorCode: string;

  /**
   * 收藏时间
   */
  @ApiProperty({ description: '收藏时间', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: Date;

  /**
   * 最后更新时间
   */
  @ApiProperty({
    description: '最后更新时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  updatedAt: Date;
}

/**
 * 专业收藏详情响应 DTO（包含专业信息）
 */
export class MajorFavoriteDetailResponseDto extends MajorFavoriteResponseDto {
  /**
   * 专业信息
   */
  @ApiProperty({
    description: '专业信息',
    type: 'object',
    required: false,
  })
  @Expose()
  major?: {
    id: number;
    name: string;
    code: string;
    level: number;
    eduLevel: string;
  };
}

