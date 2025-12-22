import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 查询热门专业问卷答案 DTO
 */
export class QueryPopularMajorAnswerDto {
  @ApiProperty({
    description: '页码，默认为 1',
    example: 1,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码必须大于0' })
  page?: number = 1;

  @ApiProperty({
    description: '每页数量，默认为 10',
    example: 10,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于0' })
  limit?: number = 10;

  @ApiProperty({
    description: '用户ID（可选，不传则查询当前登录用户）',
    example: 1,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId?: number;

  @ApiProperty({
    description: '热门专业ID（可选）',
    example: 1,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '热门专业ID必须是整数' })
  @Min(1, { message: '热门专业ID必须大于0' })
  popularMajorId?: number;

  @ApiProperty({
    description: '量表ID（可选）',
    example: 100,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '量表ID必须是整数' })
  @Min(1, { message: '量表ID必须大于0' })
  scaleId?: number;
}

