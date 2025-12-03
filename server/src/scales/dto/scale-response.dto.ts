import { Expose, Type } from 'class-transformer';
import { ScaleAnswerResponseDto } from './scale-answer-response.dto';

/**
 * 量表选项响应 DTO
 */
export class ScaleOptionResponseDto {
  @Expose()
  id: number;

  @Expose()
  optionName: string;

  @Expose()
  optionValue: number;

  @Expose()
  displayOrder: number | null;

  @Expose()
  additionalInfo: string | null;
}

/**
 * 量表响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class ScaleResponseDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  elementId: number;

  @Expose()
  type: 'like' | 'talent';

  @Expose()
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动';

  @Expose()
  @Type(() => ScaleOptionResponseDto)
  options?: ScaleOptionResponseDto[];

  @Expose()
  @Type(() => ScaleAnswerResponseDto)
  answers?: ScaleAnswerResponseDto[];
}

/**
 * 量表与答案组合响应 DTO
 * 包含量表列表和答案列表
 */
export class ScalesWithAnswersResponseDto {
  @Expose()
  @Type(() => ScaleResponseDto)
  scales: ScaleResponseDto[];

  @Expose()
  @Type(() => ScaleAnswerResponseDto)
  answers: ScaleAnswerResponseDto[];
}

