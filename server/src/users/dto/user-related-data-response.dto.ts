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

  /** 量表问卷重新作答次数（快照 version 最大值，无快照为 0） */
  @Expose()
  repeatCount: number;

  @Expose()
  preferredSubjects?: string;

  @Expose()
  provinceFavorites?: string[];

  @Expose()
  enrollType?: string;
}

