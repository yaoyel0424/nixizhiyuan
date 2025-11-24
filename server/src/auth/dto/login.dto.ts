import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 用户登录 DTO
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '用户名或邮箱不能为空' })
  usernameOrEmail: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

