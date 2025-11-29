import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 创建用户 DTO
 * 通过 openid、nickname、avatarUrl、unionid 进行创建，其他字段默认为 null
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'openid 不能为空' })
  openid: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  unionid?: string;
}

