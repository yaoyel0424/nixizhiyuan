import { Expose } from 'class-transformer';

/**
 * 用户相关数据响应 DTO（只返回数量）
 */
export class UserRelatedDataResponseDto {
  @Expose()
  scaleAnswersCount: number;

  @Expose()
  majorFavoritesCount: number;

  @Expose()
  provinceFavoritesCount: number;

  @Expose()
  choicesCount: number;

  @Expose()
  preferredSubjects?: string;
}

