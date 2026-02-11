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
 * SQL 注入常见模式（用于 query、body 检测，拦截疑似注入请求）
 * 仅检测明显恶意片段，避免误伤正常内容
 */
const SQL_INJECTION_PATTERNS = [
  /\b(union\s+all\s+select|union\s+select)\b/i,
  /\b(insert\s+into|update\s+.*\s+set)\s+.*\bwhere\b/i,
  /\b(drop\s+table|truncate\s+table|delete\s+from)\s/i,
  /\b(exec\s*\(|execute\s*\(|execute immediate)\s*/i,
  /\b(select\s+.*\s+from\s+information_schema|from\s+pg_|from\s+sys\.)\b/i,
  /'\s*or\s*'1'\s*=\s*'1|"\s*or\s*"1"\s*=\s*"1/i,
  /;\s*(drop|delete|insert|update|truncate)\s/i,
  /--\s*$|#\s*$/m,
  /\b(benchmark|sleep)\s*\(/i,
  /\b(extractvalue|updatexml)\s*\(/i,
];

/**
 * JNDI / Log4j 类 RCE 探测（用于 query、body 检测，命中则直接封禁 IP）
 * 拦截 ${jndi:...}、jndi:rmi/ldap 等载荷，防止 Log4j 等漏洞探测与利用
 */
const JNDI_INJECTION_PATTERNS = [
  /\$\{jndi\s*:/i,
  /\$\{env\s*:/i,
  /\$\{sys\s*:/i,
  /\$\{java\s*:/i,
  /\$\{lower\s*:/i,
  /jndi\s*:\s*(rmi|ldap|ldaps|dns|nis|corba)\s*:/i,
  /\$\{[^}]*jndi[^}]*\}/i,
];

/**
 * 安全中间件
 * 检测和阻止恶意请求
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(private readonly securityLogService: SecurityLogService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { url, method, body, query } = req;
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

    // SQL 注入检测：URL 查询字符串，命中则直接封禁 IP（不速率限制）
    const queryStr = typeof query === 'object' && query !== null ? JSON.stringify(query) : String(query ?? '');
    if (queryStr && this.isSqlInjectionAttempt(queryStr)) {
      await this.securityLogService.logMaliciousRequestAndBlockIp(req, 'SQL 注入检测(Query)', {
        url,
        method,
        userAgent,
        snippet: queryStr.substring(0, 200),
      });
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }
    // JNDI/Log4j 类探测：Query，命中则直接封禁 IP
    if (queryStr && this.isJndiInjectionAttempt(queryStr)) {
      await this.securityLogService.logMaliciousRequestAndBlockIp(req, 'JNDI/Log4j 注入检测(Query)', {
        url,
        method,
        userAgent,
        snippet: queryStr.substring(0, 200),
      });
      throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    }

    // 检查请求体中的恶意内容（含 SQL 注入、JNDI 探测），命中则直接封禁 IP
    if (body && typeof body === 'object') {
      const bodyStr = JSON.stringify(body);
      if (this.isMaliciousPayload(bodyStr)) {
        await this.securityLogService.logMaliciousRequestAndBlockIp(req, '恶意负载检测', {
          url,
          method,
          userAgent,
          body: bodyStr.substring(0, 200),
        });
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      }
      if (this.isSqlInjectionAttempt(bodyStr)) {
        await this.securityLogService.logMaliciousRequestAndBlockIp(req, 'SQL 注入检测(Body)', {
          url,
          method,
          userAgent,
          body: bodyStr.substring(0, 200),
        });
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      }
      if (this.isJndiInjectionAttempt(bodyStr)) {
        await this.securityLogService.logMaliciousRequestAndBlockIp(req, 'JNDI/Log4j 注入检测(Body)', {
          url,
          method,
          userAgent,
          body: bodyStr.substring(0, 200),
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
   * 检查是否包含疑似 SQL 注入片段（用于防 SQL 注入）
   */
  private isSqlInjectionAttempt(input: string): boolean {
    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  }

  /**
   * 检查是否包含 JNDI/Log4j 类 RCE 探测载荷（命中则直接封禁 IP）
   */
  private isJndiInjectionAttempt(input: string): boolean {
    return JNDI_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
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

