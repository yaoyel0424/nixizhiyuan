import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '@/redis/redis.service';
import { ConfigService } from '@nestjs/config';

/**
 * IP 封禁守卫
 * 使用 Redis 存储被封禁的 IP 列表
 */
@Injectable()
export class IpBlockGuard implements CanActivate {
  private readonly logger = new Logger(IpBlockGuard.name);
  private readonly blockDuration: number; // 封禁时长（秒）
  private readonly maxViolations: number; // 触发封禁的最大违规次数
  private readonly violationWindow: number; // 违规计数窗口（秒）

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // 从环境变量读取配置，默认值
    this.blockDuration =
      parseInt(this.configService.get<string>('SECURITY_IP_BLOCK_DURATION', '3600'), 10) || 3600; // 默认1小时
    this.maxViolations =
      parseInt(this.configService.get<string>('SECURITY_MAX_VIOLATIONS', '5'), 10) || 5; // 默认5次
    this.violationWindow =
      parseInt(this.configService.get<string>('SECURITY_VIOLATION_WINDOW', '300'), 10) || 300; // 默认5分钟
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // 检查 IP 是否被封禁
    const isBlocked = await this.isIpBlocked(ip);
    if (isBlocked) {
      this.logger.warn(`封禁的 IP 尝试访问: ${ip}, URL: ${request.url}`);
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return true;
  }

  /**
   * 检查 IP 是否被封禁
   */
  async isIpBlocked(ip: string): Promise<boolean> {
    try {
      const blockKey = `ip_block:${ip}`;
      const exists = await this.redisService.exists(blockKey);
      return exists;
    } catch (error) {
      // Redis 连接失败时，不阻止请求（容错处理）
      this.logger.warn(`Redis 连接失败，跳过 IP 封禁检查: ${error.message}`);
      return false;
    }
  }

  /**
   * 封禁 IP
   */
  async blockIp(ip: string, duration?: number): Promise<void> {
    try {
      const blockKey = `ip_block:${ip}`;
      const blockDuration = duration || this.blockDuration;
      await this.redisService.set(blockKey, '1', blockDuration);
      this.logger.warn(`IP 已被封禁: ${ip}, 时长: ${blockDuration}秒`);
    } catch (error) {
      this.logger.error(`封禁 IP 失败: ${ip}`, error);
    }
  }

  /**
   * 解封 IP
   */
  async unblockIp(ip: string): Promise<void> {
    try {
      const blockKey = `ip_block:${ip}`;
      await this.redisService.del(blockKey);
      this.logger.log(`IP 已解封: ${ip}`);
    } catch (error) {
      this.logger.error(`解封 IP 失败: ${ip}`, error);
    }
  }

  /**
   * 记录违规行为
   * 如果违规次数超过阈值，自动封禁 IP
   */
  async recordViolation(ip: string): Promise<void> {
    try {
      const violationKey = `ip_violation:${ip}`;
      const currentCount = await this.redisService.get(violationKey);
      const count = currentCount ? parseInt(currentCount, 10) + 1 : 1;

      // 设置违规计数，使用窗口时长作为 TTL
      await this.redisService.set(violationKey, count.toString(), this.violationWindow);

      // 如果违规次数超过阈值，封禁 IP
      if (count >= this.maxViolations) {
        await this.blockIp(ip);
        // 清除违规计数
        await this.redisService.del(violationKey);
        this.logger.warn(
          `IP 因违规次数过多被自动封禁: ${ip}, 违规次数: ${count}`,
        );
      } else {
        this.logger.warn(`IP 违规记录: ${ip}, 当前违规次数: ${count}/${this.maxViolations}`);
      }
    } catch (error) {
      this.logger.error(`记录违规行为失败: ${ip}`, error);
    }
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

