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
    brief: string | null;
    level: number;
    eduLevel: string;
  };

  /**
   * 专业匹配分数
   */
  @ApiProperty({
    description: '专业匹配分数',
    type: 'number',
    required: false,
    example: 85.5,
  })
  @Expose()
  score?: number;

  /**
   * 乐学分数
   */
  @ApiProperty({
    description: '乐学分数',
    type: 'number',
    required: false,
    example: 45.2,
  })
  @Expose()
  lexueScore?: number;

  /**
   * 善学分数
   */
  @ApiProperty({
    description: '善学分数',
    type: 'number',
    required: false,
    example: 40.3,
  })
  @Expose()
  shanxueScore?: number;

  /**
   * 厌学扣分
   */
  @ApiProperty({
    description: '厌学扣分',
    type: 'number',
    required: false,
    example: 0,
  })
  @Expose()
  yanxueDeduction?: number;

  /**
   * 挑战扣分
   */
  @ApiProperty({
    description: '挑战扣分',
    type: 'number',
    required: false,
    example: 0,
  })
  @Expose()
  tiaozhanDeduction?: number;
}

/**
 * 用户收藏列表响应 DTO（包含用户信息和收藏列表）
 */
export class UserFavoritesResponseDto {
  /**
   * 用户信息
   */
  @ApiProperty({
    description: '用户信息',
    type: 'object',
  })
  @Expose()
  user: {
    id: number;
    nickname?: string | null;
  };

  /**
   * 收藏列表
   */
  @ApiProperty({
    description: '收藏列表',
    type: [MajorFavoriteDetailResponseDto],
  })
  @Expose()
  items: MajorFavoriteDetailResponseDto[];

  /**
   * 分页信息
   */
  @ApiProperty({
    description: '分页信息',
    type: 'object',
  })
  @Expose()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

