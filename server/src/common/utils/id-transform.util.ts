import { ConfigService } from '@nestjs/config';

/**
 * ID 对称转换工具类
 * 使用异或（^）操作和固定偏移值进行 ID 的转换和反转换
 */
export class IdTransformUtil {
  /**
   * 将真实 ID 转换为混淆 ID
   * 公式：混淆ID = (真实ID ^ SECRET_KEY) + OFFSET
   * @param realId 真实 ID
   * @param configService 配置服务（可选，如果不提供则从环境变量读取）
   * @returns 混淆后的 ID
   */
  static encode(
    realId: number | null,
    configService?: ConfigService,
  ): number | null {
    if (realId === null || realId === undefined) {
      return null;
    }

    const secretKey =
      configService?.get<number>('SECRET_KEY') ||
      parseInt(process.env.SECRET_KEY || '0', 10);
    const offset =
      configService?.get<number>('OFFSET') ||
      parseInt(process.env.OFFSET || '0', 10);

    return (realId ^ secretKey) + offset;
  }

  /**
   * 将混淆 ID 转换为真实 ID
   * 公式：真实ID = (混淆ID - OFFSET) ^ SECRET_KEY
   * @param encodedId 混淆后的 ID
   * @param configService 配置服务（可选，如果不提供则从环境变量读取）
   * @returns 真实 ID
   */
  static decode(
    encodedId: number | null,
    configService?: ConfigService,
  ): number | null {
    if (encodedId === null || encodedId === undefined) {
      return null;
    }

    const secretKey =
      configService?.get<number>('SECRET_KEY') ||
      parseInt(process.env.SECRET_KEY || '0', 10);
    const offset =
      configService?.get<number>('OFFSET') ||
      parseInt(process.env.OFFSET || '0', 10);

    return (encodedId - offset) ^ secretKey;
  }
}

