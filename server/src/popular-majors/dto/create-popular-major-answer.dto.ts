import { IsInt, IsNotEmpty, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建热门专业问卷答案 DTO
 */
export class CreatePopularMajorAnswerDto {
  /**
   * 热门专业ID
   */
  @ApiProperty({
    description: '热门专业ID',
    example: 1,
    type: Number,
  })
  @IsInt()
  @IsNotEmpty({ message: '热门专业ID不能为空' })
  @Min(1, { message: '热门专业ID必须大于0' })
  popularMajorId: number;

  /**
   * 量表ID（问卷题目ID）
   */
  @ApiProperty({
    description: '量表ID（问卷题目ID）',
    example: 100,
    type: Number,
  })
  @IsInt()
  @IsNotEmpty({ message: '量表ID不能为空' })
  @Min(1, { message: '量表ID必须大于0' })
  scaleId: number;

  /**
   * 得分（值范围为 -2 到 2）
   */
  @ApiProperty({
    description: '得分（值范围为 -2 到 2）',
    example: 1.5,
    type: Number,
    minimum: -2,
    maximum: 2,
  })
  @IsNumber({}, { message: '得分必须是数字' })
  @IsNotEmpty({ message: '得分不能为空' })
  @Min(-2, { message: '得分不能小于 -2' })
  @Max(2, { message: '得分不能大于 2' })
  score: number;
}

