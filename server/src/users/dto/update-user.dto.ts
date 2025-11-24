import { IsString, IsEmail, IsOptional, MinLength, IsArray } from 'class-validator';

/**
 * 更新用户 DTO
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: '用户名至少 3 个字符' })
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少 6 个字符' })
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  avatar?: string;
}

