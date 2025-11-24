import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 刷新令牌 DTO
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}

