import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 自助终端：创建或更新匿名量表答案请求体
 */
export class CreateAnonymousScaleAnswerDto {
  @ApiProperty({ description: '匿名用户ID（anonymous_users.id）', example: 1, type: Number })
  @IsInt()
  @IsNotEmpty({ message: '匿名用户ID不能为空' })
  @Min(1, { message: '匿名用户ID必须大于0' })
  anonymousUserId: number;

  @ApiProperty({ description: '量表ID', example: 1, type: Number })
  @IsInt()
  @IsNotEmpty({ message: '量表ID不能为空' })
  @Min(1, { message: '量表ID必须大于0' })
  scaleId: number;

  @ApiProperty({ description: '得分', example: 5, type: Number })
  @IsInt()
  @IsNotEmpty({ message: '得分不能为空' })
  score: number;
}
