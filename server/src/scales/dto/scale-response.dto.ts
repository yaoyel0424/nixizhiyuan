import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ScaleAnswerResponseDto } from './scale-answer-response.dto';

/**
 * 量表选项响应 DTO
 */
export class ScaleOptionResponseDto {
  @ApiProperty({ description: '选项ID', example: 1, type: Number })
  @Expose()
  id: number;

  @ApiProperty({ description: '选项名称', example: '非常同意', type: String })
  @Expose()
  optionName: string;

  @ApiProperty({ description: '选项值', example: 5, type: Number })
  @Expose()
  optionValue: number;

  @ApiProperty({ description: '显示顺序', example: 1, type: Number, nullable: true })
  @Expose()
  displayOrder: number | null;

  @ApiProperty({ description: '附加信息', example: null, type: String, nullable: true })
  @Expose()
  additionalInfo: string | null;
}

/**
 * 量表响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class ScaleResponseDto {
  @ApiProperty({ description: '量表ID', example: 1, type: Number })
  @Expose()
  id: number;

  @ApiProperty({ description: '量表内容', example: '我喜欢观察周围的环境', type: String })
  @Expose()
  content: string;

  @ApiProperty({ description: '元素ID', example: 1, type: Number })
  @Expose()
  elementId: number;

  @ApiProperty({
    description: '量表类型',
    example: 'like',
    enum: ['like', 'talent'],
  })
  @Expose()
  type: 'like' | 'talent';

  @ApiProperty({
    description: '维度',
    example: '看',
    enum: ['看', '听', '说', '记', '想', '做', '运动'],
  })
  @Expose()
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动';

  @ApiProperty({
    description: '量表选项列表',
    type: [ScaleOptionResponseDto],
    required: false,
  })
  @Expose()
  @Type(() => ScaleOptionResponseDto)
  options?: ScaleOptionResponseDto[];

  @ApiProperty({
    description: '用户答案列表',
    type: [ScaleAnswerResponseDto],
    required: false,
  })
  @Expose()
  @Type(() => ScaleAnswerResponseDto)
  answers?: ScaleAnswerResponseDto[];
}

/**
 * 量表与答案组合响应 DTO
 * 包含量表列表和答案列表
 */
export class ScalesWithAnswersResponseDto {
  @ApiProperty({
    description: '量表列表',
    type: [ScaleResponseDto],
  })
  @Expose()
  @Type(() => ScaleResponseDto)
  scales: ScaleResponseDto[];

  @ApiProperty({
    description: '答案列表',
    type: [ScaleAnswerResponseDto],
  })
  @Expose()
  @Type(() => ScaleAnswerResponseDto)
  answers: ScaleAnswerResponseDto[];
}

