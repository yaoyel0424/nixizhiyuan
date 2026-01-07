import { Expose, Exclude } from 'class-transformer';

/**
 * 用户响应 DTO
 * 使用 class-transformer 进行序列化，不包含敏感信息（如 openid、unionid）
 */
export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  nickname?: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  province?: string;

  @Expose()
  score?: number;

  @Expose()
  preferredSubjects?: string;

  @Expose()
  secondarySubjects?: string;

  @Expose()
  rank?: number;

  @Expose()
  enrollType?: string;

  @Expose()
  userType: 'child' | 'adult';

  @Expose()
  age?: number;

  @Expose()
  gender?: string;

  @Expose()
  createdAt: Date;

  @Exclude()
  openid?: string;

  @Exclude()
  unionid?: string;
}

