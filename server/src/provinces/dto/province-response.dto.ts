import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 省份响应 DTO
 */
export class ProvinceResponseDto {
  /**
   * 省份ID
   */
  @ApiProperty({ description: '省份ID', example: 11 })
  @Expose()
  id: number;

  /**
   * 省份名称
   */
  @ApiProperty({ description: '省份名称', example: '北京市' })
  @Expose()
  name: string;

  /**
   * 省份类型
   */
  @ApiProperty({ description: '省份类型', example: '直辖市' })
  @Expose()
  type: string;

  /**
   * 总体印象
   */
  @ApiProperty({ description: '总体印象', required: false })
  @Expose()
  overallImpression?: string;

  /**
   * 生活成本
   */
  @ApiProperty({ description: '生活成本', required: false })
  @Expose()
  livingCost?: string;

  /**
   * 适合人群
   */
  @ApiProperty({ description: '适合人群', required: false })
  @Expose()
  suitablePerson?: string;

  /**
   * 不适合人群
   */
  @ApiProperty({ description: '不适合人群', required: false })
  @Expose()
  unsuitablePerson?: string;

  /**
   * 重点产业
   */
  @ApiProperty({ description: '重点产业', required: false })
  @Expose()
  keyIndustries?: string;

  /**
   * 重点岗位
   */
  @ApiProperty({ description: '重点岗位', required: false })
  @Expose()
  typicalEmployers?: string;
}

/**
 * 查询所有省份响应 DTO（包含类型列表）
 */
export class ProvincesListResponseDto {
  /**
   * 省份列表
   */
  @ApiProperty({
    description: '省份列表',
    type: [ProvinceResponseDto],
  })
  @Expose()
  provinces: ProvinceResponseDto[];

  /**
   * 省份类型列表（去重）
   */
  @ApiProperty({
    description: '省份类型列表（去重）',
    type: [String],
    example: ['直辖市', '华北地区', '华东地区'],
  })
  @Expose()
  types: string[];
}

/**
 * 省份收藏响应 DTO
 */
export class ProvinceFavoriteResponseDto {
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
   * 省份ID
   */
  @ApiProperty({ description: '省份ID', example: 11 })
  @Expose()
  provinceId: number;

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
 * 省份收藏详情响应 DTO（包含省份信息）
 */
export class ProvinceFavoriteDetailResponseDto extends ProvinceFavoriteResponseDto {
  /**
   * 省份信息
   */
  @ApiProperty({
    description: '省份信息',
    type: ProvinceResponseDto,
    required: false,
  })
  @Expose()
  @Type(() => ProvinceResponseDto)
  province?: ProvinceResponseDto;
}

