import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '@/redis/redis.service';
import { IpBlockGuard } from '../guards/ip-block.guard';

/**
 * 安全日志服务
 * 记录安全事件并自动触发 IP 封禁
 */
@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name);

  constructor(
    private readonly redisService: RedisService,
  ) {}

  // 延迟注入 IpBlockGuard，避免循环依赖
  private ipBlockGuard: IpBlockGuard;

  setIpBlockGuard(ipBlockGuard: IpBlockGuard) {
    this.ipBlockGuard = ipBlockGuard;
  }

  /**
   * 记录安全威胁
   */
  async logSecurityThreat(
    type: string,
    request: Request,
    details?: Record<string, any>,
  ): Promise<void> {
    const ip = this.getClientIp(request);
    const { url, method, headers } = request;
    const userAgent = headers['user-agent'] || '';

    // 记录日志
    this.logger.warn(
      `[安全威胁] ${type} - IP: ${ip}, URL: ${url}, Method: ${method}`,
      {
        type,
        ip,
        url,
        method,
        userAgent,
        ...details,
      },
    );

    // 记录违规行为（自动触发 IP 封禁逻辑）
    if (this.ipBlockGuard) {
      await this.ipBlockGuard.recordViolation(ip);
    }
  }

  /**
   * 记录恶意请求（并记录违规，达到次数后封禁）
   */
  async logMaliciousRequest(
    request: Request,
    reason: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityThreat('MALICIOUS_REQUEST', request, {
      reason,
      ...details,
    });
  }

  /**
   * 记录恶意请求并立即封禁 IP（用于 SQL 注入、严重恶意负载等，不做速率限制）
   */
  async logMaliciousRequestAndBlockIp(
    request: Request,
    reason: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const ip = this.getClientIp(request);
    this.logger.warn(`[安全威胁] 立即封禁 IP - ${reason} - IP: ${ip}`, { reason, ip, ...details });
    if (this.ipBlockGuard) {
      await this.ipBlockGuard.blockIp(ip);
    }
  }

  /**
   * 记录可疑活动
   */
  async logSuspiciousActivity(
    request: Request,
    reason: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityThreat('SUSPICIOUS_ACTIVITY', request, {
      reason,
      ...details,
    });
  }

  /**
   * 获取客户端真实 IP
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}

