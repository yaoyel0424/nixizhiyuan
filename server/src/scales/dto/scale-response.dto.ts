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
 * 快照信息（仅 repeat=true 时返回）
 */
export class ScaleSnapshotResponseDto {
  @ApiProperty({ description: '快照版本', example: '1' })
  @Expose()
  version: string;

  @ApiProperty({ description: '快照创建时间' })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: '快照内容',
    example: { answers: [{ scaleId: 113, score: 5, submittedAt: '2024-01-01T00:00:00.000Z' }], savedAt: '2024-01-01T00:00:00.000Z' },
  })
  @Expose()
  payload: { answers: Array<{ scaleId: number; score: number; submittedAt: string | null }>; savedAt: string };
}

/**
 * 量表与答案组合响应 DTO
 * 包含量表列表和答案列表；repeat=true 时额外包含 snapshot
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

  @ApiProperty({
    description: '快照信息（仅 repeat=true 且存在快照时返回）',
    type: ScaleSnapshotResponseDto,
    required: false,
  })
  @Expose()
  @Type(() => ScaleSnapshotResponseDto)
  snapshot?: ScaleSnapshotResponseDto;
}

