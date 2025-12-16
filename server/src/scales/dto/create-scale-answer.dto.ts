import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建量表答案 DTO
 */
export class CreateScaleAnswerDto {
  /**
   * 量表ID
   */
  @ApiProperty({
    description: '量表ID',
    example: 1,
    type: Number,
  })
  @IsInt()
  @IsNotEmpty({ message: '量表ID不能为空' })
  @Min(1, { message: '量表ID必须大于0' })
  scaleId: number;

  /**
   * 用户ID
   */
  @ApiProperty({
    description: '用户ID',
    example: 1,
    type: Number,
  })
  @IsInt()
  @IsNotEmpty({ message: '用户ID不能为空' })
  @Min(1, { message: '用户ID必须大于0' })
  userId: number;

  /**
   * 得分
   */
  @ApiProperty({
    description: '得分',
    example: 5,
    type: Number,
  })
  @IsInt()
  @IsNotEmpty({ message: '得分不能为空' })
  score: number;
}

