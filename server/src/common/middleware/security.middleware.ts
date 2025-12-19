import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import { SecurityLogService } from '../services/security-log.service';

/**
 * 恶意路径模式列表
 * 用于检测和阻止常见的扫描和攻击尝试
 */
const MALICIOUS_PATTERNS = [
  // Laravel 相关漏洞
  /\/vendor\/laravel-filemanager/i,
  /\/_ignition\//i,
  /\/public\/vendor\/laravel-filemanager/i,
  
  // Git 信息泄露
  /\/\.git\//i,
  /\/\.git$/i,
  
  // 敏感文件扫描
  /\/\.env/i,
  /\/\.env\.example/i,
  /\/admin\/config\.php/i,
  /\/config\.php/i,
  /\/login\.asp/i,
  
  // PHP 相关漏洞
  /\/vendor\/phpunit\//i,
  /\/app_dev\.php/i,
  
  // 网络设备扫描
  /\/\+CSCOL\+\//i,
  /\/\+CSCOE\+\//i,
  /\/HNAP1/i,
  /\/evox\//i,
  /\/sdk/i,
  
  // 其他常见扫描路径
  /\/html\/ie\.html/i,
  /\/nmaplowercheck/i,
  /\/\.well-known\/security\.txt/i,
  /\/robots\.txt/i, // 如果不需要，可以阻止
  
  // 恶意 payload 检测（在 body 中）
  /androxgh0st/i,
  /0x/i,
];

/**
 * 安全中间件
 * 检测和阻止恶意请求
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(private readonly securityLogService: SecurityLogService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { url, method, body, ip } = req;
    const userAgent = req.get('user-agent') || '';

    // 检查 URL 路径
    if (this.isMaliciousPath(url)) {
      // 使用安全日志服务记录并触发 IP 封禁逻辑
      this.securityLogService.logMaliciousRequest(req, '恶意路径检测', {
        url,
        method,
        userAgent,
      });
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }

    // 检查请求体中的恶意内容
    if (body && typeof body === 'object') {
      const bodyStr = JSON.stringify(body);
      if (this.isMaliciousPayload(bodyStr)) {
        // 使用安全日志服务记录并触发 IP 封禁逻辑
        this.securityLogService.logMaliciousRequest(req, '恶意负载检测', {
          url,
          method,
          userAgent,
          body: bodyStr.substring(0, 200), // 只记录前200字符
        });
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      }
    }

    // 检查 User-Agent（常见扫描工具）
    if (this.isSuspiciousUserAgent(userAgent)) {
      // 记录可疑活动（不阻止，但记录）
      this.securityLogService.logSuspiciousActivity(req, '可疑 User-Agent', {
        userAgent,
      });
    }

    next();
  }

  /**
   * 检查是否为恶意路径
   */
  private isMaliciousPath(url: string): boolean {
    return MALICIOUS_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * 检查是否为恶意负载
   */
  private isMaliciousPayload(body: string): boolean {
    return MALICIOUS_PATTERNS.some((pattern) => pattern.test(body));
  }

  /**
   * 检查是否为可疑 User-Agent
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /scanner/i,
      /bot/i,
      /crawler/i,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

}

