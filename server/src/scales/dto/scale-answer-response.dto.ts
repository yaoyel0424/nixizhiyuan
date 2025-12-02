import { Expose, Type } from 'class-transformer';

/**
 * 量表答案响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class ScaleAnswerResponseDto {
  @Expose()
  id: number;

  @Expose()
  scaleId: number;

  @Expose()
  userId: number;

  @Expose()
  score: number;

  @Expose()
  submittedAt: Date;
}

