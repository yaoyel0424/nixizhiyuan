import { IsInt, IsNotEmpty, Min } from 'class-validator';

/**
 * 创建量表答案 DTO
 */
export class CreateScaleAnswerDto {
  /**
   * 量表ID
   */
  @IsInt()
  @IsNotEmpty({ message: '量表ID不能为空' })
  @Min(1, { message: '量表ID必须大于0' })
  scaleId: number;

  /**
   * 用户ID
   */
  @IsInt()
  @IsNotEmpty({ message: '用户ID不能为空' })
  @Min(1, { message: '用户ID必须大于0' })
  userId: number;

  /**
   * 得分
   */
  @IsInt()
  @IsNotEmpty({ message: '得分不能为空' })
  score: number;
}

