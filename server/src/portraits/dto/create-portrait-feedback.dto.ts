import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建画像反馈 DTO
 */
export class CreatePortraitFeedbackDto {
  /**
   * 反馈选项
   * 如：非常符合、比较符合、一般、不太符合、完全不符合、符合我以前的状态
   */
  @ApiProperty({
    description: '反馈选项',
    example: '非常符合',
    enum: ['非常符合', '比较符合', '一般', '不太符合', '完全不符合', '符合我以前的状态'],
  })
  @IsString({ message: '反馈选项必须是字符串' })
  @MaxLength(64, { message: '反馈选项不能超过64个字符' })
  option: string;

  /**
   * 画像ID（可选），针对某张画像的反馈
   */
  @ApiProperty({
    description: '画像ID（可选）',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: '画像ID必须是整数' })
  @Min(1, { message: '画像ID必须大于0' })
  portraitId?: number;
}
