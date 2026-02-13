import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Header,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Public } from '@/common/decorators/public.decorator';
import { HtmlService } from './html.service';

/**
 * 后台 HTML 页面控制器
 * 提供量表展示、登录与修改（浏览器直接访问）
 */
@Controller('html')
@Public()
export class HtmlController {
  private readonly apiPrefix: string;

  constructor(
    private readonly htmlService: HtmlService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.apiPrefix = this.configService.get<string>('app.prefix') || 'api/v1';
  }

  /**
   * 校验 cookie 中的 JWT，返回 payload 或 null
   */
  private verifyToken(req: Request): { sub: number } | null {
    const token = req.cookies?.access_token;
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      return payload && payload.sub ? { sub: payload.sub } : null;
    } catch {
      return null;
    }
  }

  /**
   * GET /html/scales.js - 量表管理页用脚本（外部引入，避免内联脚本被拦截）
   */
  @Get('scales.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  scalesScript(@Res() res: Response): void {
    res.send(this.htmlService.getScalesScript());
  }

  /**
   * GET /html/scales - 量表管理页
   * 未登录返回登录页 HTML，已登录返回量表列表与编辑表单 HTML
   */
  @Get('scales')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async scalesPage(@Req() req: Request, @Res() res: Response): Promise<void> {
    const payload = this.verifyToken(req);
    if (!payload) {
      res.send(this.htmlService.buildLoginPage(this.apiPrefix));
      return;
    }
    const scales = await this.htmlService.getScalesWithOptions();
    res.send(this.htmlService.buildScalesPage(scales, this.apiPrefix));
  }

  /**
   * POST /html/login - 登录（密钥校验），设置 cookie 后重定向到 /html/scales
   */
  @Post('login')
  async login(
    @Body('secret') secret: string,
    @Res() res: Response,
  ): Promise<void> {
    const expected = this.configService.get<string>('ADMIN_HTML_SECRET')??"123456";
    const adminUserId = this.configService.get<number>('ADMIN_HTML_USER_ID') ?? 1;
    if (!expected || secret !== expected) {
      const html = this.htmlService.buildLoginPage(
        this.apiPrefix,
        '密钥错误',
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(401).send(html);
      return;
    }
    const token = this.jwtService.sign(
      { sub: adminUserId },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn') || '7d',
      },
    );
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 天
    res.cookie('access_token', token, {
      httpOnly: true,
      maxAge,
      path: '/',
      sameSite: 'lax',
    });
    res.redirect(302, `/${this.apiPrefix}/html/scales`);
  }

  /**
   * GET /html/logout - 清除 cookie 并重定向到量表页（显示登录）
   */
  @Get('logout')
  async logout(@Res() res: Response): Promise<void> {
    res.clearCookie('access_token', { path: '/' });
    res.redirect(302, `/${this.apiPrefix}/html/scales`);
  }
}
