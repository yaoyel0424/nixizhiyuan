import { ConfigService } from '@nestjs/config';

/** 32 位字符串编解码用常量（简单防伪校验） */
const K1 = 0x9e3779b97f4a7c15n;
const K2 = 0x6b4a2c3e1d5f8a9bn;

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

  /**
   * 将数字 ID 编码为 32 位十六进制字符串（可逆，带简单防伪校验）
   * 格式：前 16 位为 id 的 8 字节大端表示，后 16 位为 (id*K1+K2) 的 8 字节校验
   * @param id 数字 ID（建议 0 ~ 2^53 以内）
   * @returns 32 位小写十六进制字符串，非法 id 返回 null
   */
  static encodeTo32Hex(id: number | null | undefined): string | null {
    if (id == null || typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
      return null;
    }
    const idBig = BigInt(id);
    const sig = (idBig * K1 + K2) & 0xffffffffffffffffn;
    const buf = Buffer.alloc(16);
    buf.writeBigUInt64BE(idBig, 0);
    buf.writeBigUInt64BE(sig, 8);
    return buf.toString('hex');
  }

  /**
   * 将 32 位十六进制字符串解码为数字 ID（校验防伪，非法或篡改则返回 null）
   * @param str 由 encodeTo32Hex 生成的 32 位十六进制字符串
   * @returns 解码后的数字 ID，校验失败或格式错误返回 null
   */
  static decodeFrom32Hex(str: string | null | undefined): number | null {
    if (str == null || typeof str !== 'string' || str.length !== 32 || !/^[0-9a-fA-F]+$/.test(str)) {
      return null;
    }
    const buf = Buffer.from(str, 'hex');
    if (buf.length !== 16) return null;
    const idBig = buf.readBigUInt64BE(0);
    const sig = buf.readBigUInt64BE(8);
    const expected = (idBig * K1 + K2) & 0xffffffffffffffffn;
    if (sig !== expected) return null;
    const id = Number(idBig);
    if (!Number.isSafeInteger(id) || id < 0) return null;
    return id;
  }
}

