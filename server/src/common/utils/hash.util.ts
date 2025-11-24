import * as bcrypt from 'bcrypt';

/**
 * 密码加密工具
 */
export class HashUtil {
  /**
   * 加密密码
   * @param password 原始密码
   * @param saltRounds 盐值轮数，默认 10
   * @returns 加密后的密码
   */
  static async hashPassword(
    password: string,
    saltRounds: number = 10,
  ): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * 验证密码
   * @param password 原始密码
   * @param hashedPassword 加密后的密码
   * @returns 是否匹配
   */
  static async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}

