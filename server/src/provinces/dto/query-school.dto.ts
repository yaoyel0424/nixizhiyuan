import { IsOptional, IsInt, Min, Max, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { APP_CONSTANTS } from '@/common/constants/app.constant';

/**
 * 查询院校 DTO（分页、按名称查询）
 */
export class QuerySchoolDto {
  @ApiProperty({
    description: '省份名称',
    example: '北京',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: '省份名称不能为空' })
  provinceName: string;

  @ApiProperty({
    description: '学校名称（模糊查询）',
    example: '大学',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = APP_CONSTANTS.DEFAULT_PAGE;

  @ApiProperty({
    description: '每页数量',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(APP_CONSTANTS.MAX_LIMIT)
  limit?: number = APP_CONSTANTS.DEFAULT_LIMIT;
}

