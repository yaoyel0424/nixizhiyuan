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
   * 将字符串编码为 32 位十六进制防伪标记（可逆，带简单防伪校验）
   * 不进行 parseInt，直接按 UTF-8 字节编码。格式：前 16 位为字符串的 8 字节（不足补 0），后 16 位为校验
   * @param id 原始字符串（UTF-8 长度不超过 8 字节，超出返回 null）
   * @returns 32 位小写十六进制字符串，非法或过长返回 null
   */
  static encodeTo32Hex(id: string | null | undefined): string | null {
    if (id == null || typeof id !== 'string') return null;
    const payload = Buffer.from(id, 'utf8');
    if (payload.length > 8) return null;
    const buf = Buffer.alloc(16);
    payload.copy(buf, 0);
    const payloadBig = buf.readBigUInt64BE(0);
    const sig = (payloadBig * K1 + K2) & 0xffffffffffffffffn;
    buf.writeBigUInt64BE(sig, 8);
    return buf.toString('hex');
  }

  /**
   * 将 32 位十六进制防伪标记解码为原字符串（校验防伪，非法或篡改则返回 null）
   * @param str 由 encodeTo32Hex 生成的 32 位十六进制字符串
   * @returns 解码后的原字符串，校验失败或格式错误返回 null
   */
  static decodeFrom32Hex(str: string | null | undefined): string | null {
    if (str == null || typeof str !== 'string' || str.length !== 32 || !/^[0-9a-fA-F]+$/.test(str)) {
      return null;
    }
    const buf = Buffer.from(str, 'hex');
    if (buf.length !== 16) return null;
    const payloadBig = buf.readBigUInt64BE(0);
    const sig = buf.readBigUInt64BE(8);
    const expected = (payloadBig * K1 + K2) & 0xffffffffffffffffn;
    if (sig !== expected) return null;
    const payload = buf.subarray(0, 8);
    const end = payload.findIndex((b) => b === 0);
    const len = end === -1 ? 8 : end;
    return payload.subarray(0, len).toString('utf8');
  }
}

