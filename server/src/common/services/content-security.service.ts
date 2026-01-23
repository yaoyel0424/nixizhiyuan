import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/redis/redis.service';

/**
 * 内容安全服务
 * 用于调用微信内容安全 API 检测文本内容
 */
@Injectable()
export class ContentSecurityService {
  private readonly logger = new Logger(ContentSecurityService.name);
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly accessTokenCacheKey = 'wechat:access_token';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.appId = this.configService.get<string>('wechat.appId') || '';
    this.appSecret = this.configService.get<string>('wechat.appSecret') || '';
  }

  /**
   * 检查文本内容是否安全
   * @param content 要检查的文本内容
   * @returns true 表示内容安全，false 表示内容违规
   * @throws BadRequestException 当内容违规时抛出异常
   */
  async checkTextSecurity(content: string): Promise<boolean> {
    if (!content || !content.trim()) {
      return true; // 空内容视为安全
    }

    try {
      // 获取 access_token
      const accessToken = await this.getAccessToken();

      // 调用微信内容安全 API
      const checkUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`;
      
      const response = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
        }),
      });

      const result = await response.json();

      // 处理 API 响应
      if (result.errcode === 0) {
        // 内容安全
        return true;
      } else if (result.errcode === 87014) {
        // 内容违规
        this.logger.warn(`内容安全检测失败：内容包含违规信息 - ${content.substring(0, 20)}...`);
        throw new BadRequestException('您发布的内容含违规信息，请修改后重试');
      } else if (result.errcode === 40001) {
        // access_token 无效，清除缓存并重试一次
        this.logger.warn('access_token 无效，清除缓存并重试');
        await this.redisService.del(this.accessTokenCacheKey);
        return await this.checkTextSecurity(content);
      } else {
        // 其他错误，记录日志但不阻止（降级处理）
        this.logger.error(
          `内容安全检测 API 调用失败: errcode=${result.errcode}, errmsg=${result.errmsg}`,
        );
        // 降级处理：如果 API 调用失败，允许通过（避免影响用户体验）
        return true;
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // 重新抛出内容违规异常
      }
      // 其他错误（网络错误等），记录日志但不阻止（降级处理）
      this.logger.error(`内容安全检测异常: ${error.message}`, error.stack);
      // 降级处理：如果 API 调用失败，允许通过（避免影响用户体验）
      return true;
    }
  }

  /**
   * 获取微信 access_token
   * 优先从 Redis 缓存获取，如果不存在或过期则重新获取
   */
  private async getAccessToken(): Promise<string> {
    // 验证配置
    if (!this.appId || !this.appSecret) {
      throw new Error('微信配置缺失：请检查 WECHAT_APP_ID 和 WECHAT_APP_SECRET 环境变量');
    }

    try {
      // 尝试从 Redis 获取缓存的 access_token
      const cachedToken = await this.redisService.get(this.accessTokenCacheKey);
      if (cachedToken) {
        return cachedToken;
      }

      // 缓存不存在，重新获取
      const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
      
      const response = await fetch(tokenUrl);
      const result = await response.json();

      if (result.errcode) {
        throw new Error(
          `获取 access_token 失败: ${result.errmsg || result.errcode} (错误码: ${result.errcode})`,
        );
      }

      const accessToken = result.access_token;
      const expiresIn = result.expires_in || 7200; // 默认 2 小时

      // 将 access_token 缓存到 Redis（提前 5 分钟过期，避免边界情况）
      const cacheExpiresIn = Math.max(expiresIn - 300, 60); // 至少缓存 1 分钟
      await this.redisService.set(
        this.accessTokenCacheKey,
        accessToken,
        cacheExpiresIn,
      );

      return accessToken;
    } catch (error) {
      this.logger.error(`获取 access_token 失败: ${error.message}`, error.stack);
      throw new Error(`获取微信 access_token 失败: ${error.message}`);
    }
  }
}
