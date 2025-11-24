/**
 * JWT 载荷接口
 */
export interface IJwtPayload {
  sub: number; // 用户 ID
  username: string; // 用户名
  email: string; // 邮箱
  roles: string[]; // 角色数组
  iat?: number; // 签发时间
  exp?: number; // 过期时间
}

