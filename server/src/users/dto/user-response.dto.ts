import { Expose, Exclude } from 'class-transformer';

/**
 * 用户响应 DTO
 * 使用 class-transformer 进行序列化，不包含敏感信息
 */
export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  username: string;

  @Expose()
  email: string;

  @Expose()
  roles: string[];

  @Expose()
  avatar?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  password?: string;

  @Exclude()
  deletedAt?: Date;
}

