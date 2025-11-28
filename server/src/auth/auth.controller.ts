import {
  Controller,
  Post,
  Body,
  UseGuards,
  All,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WechatAuthGuard } from './guards/wechat-auth.guard';

/**
 * 认证控制器
 */
@ApiTags('认证授权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
 
  @Post('refresh')
  @Public()
  @ApiOperation({ summary: '刷新令牌' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '用户登出' })
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }

  @All('wechat/login')
  @Public()
  @UseGuards(WechatAuthGuard)
  @ApiOperation({
    summary: '微信登录/回调 - 支持 GET（服务器验证/OAuth回调）和 POST（登录）',
  })
  async wechatLogin(
    @Req() req: Request,
    @Query() query: any,
    @Res() res: Response,
    @CurrentUser() user?: any,
  ) {
    // 处理 GET 请求 - 服务器验证或 OAuth 回调
    if (req.method === 'GET') {
      // 处理微信服务器验证请求
      if (query.echostr) {
        // 直接返回 echostr 用于微信服务器验证
        return res.send(query.echostr);
      }
      // 其他 GET 请求（如 OAuth 回调）可以在这里处理
      // 目前返回空响应
      return res.send('');
    }

    // 处理 POST 请求 - 微信登录
    // Guard 已经处理了 code 并返回了用户信息和 token
    if (!user) {
      return res.status(401).json({ message: '微信登录失败' });
    }

    return res.json(user);
  }
}

