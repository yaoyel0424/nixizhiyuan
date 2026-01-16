import {
  Controller,
  Post,
  Body,
  UseGuards,
  All,
  Req,
  Query,
  Res,
  Get,
  Param,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam,ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service'; 
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WechatAuthGuard } from './guards/wechat-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from './interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

/**
 * 认证控制器
 */
@ApiTags('认证授权')
@Controller('auth') 
@ApiBearerAuth()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
 
  @Post('refresh')
  @Public()
  @ApiOperation({ summary: '刷新令牌' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Get('check-token') 
  @ApiOperation({ summary: '检查 Token 是否有效' })
  async checkToken(@CurrentUser() user: any) {
    // JwtAuthGuard 已经验证了 token，如果 token 无效会抛出 401 错误
    // 如果执行到这里，说明 token 有效，返回用户信息
    const userInfo = await this.usersService.findOne(user.id);
    
    if (!userInfo) {
      throw new UnauthorizedException('用户不存在');
    }

    // 返回用户信息，格式与登录接口保持一致
    return {
      valid: true,
      user: {
        id: userInfo.id,
        username: '',
        nickname: userInfo.nickname,
        avatar:   '',
        phone: '',
        email:  '',
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '用户登出' })
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }

  @Post('wechat/login')
  @Public()
  @UseGuards(WechatAuthGuard)
  @ApiOperation({
    summary: '微信小程序登录',
    description: '通过 code 和加密的用户信息进行登录',
  })
  async wechatLogin(
    @Req() req: Request,
    @Query() query: any,
    @CurrentUser() user?: any,
  ) {
    // 处理 GET 请求 - 服务器验证
    if (req.method === 'GET' && query.echostr) {
      // 直接返回 echostr 用于微信服务器验证
      return query.echostr;
    }

    // POST 请求返回用户信息和 Token
    // user 参数由 WechatStrategy.validate() 返回的 result 注入
    if (!user) {
      throw new Error('登录失败：未获取到用户信息');
    }

    return user;
  }

  @Get('test-token/:id/:nickname')
  @Public()
  @ApiOperation({
    summary: '生成测试用 Token（仅用于开发测试）',
    description: '为指定用户ID和昵称生成测试用的 JWT Token',
  })
  @ApiParam({ name: 'id', description: '用户ID', example: 5 })
  @ApiParam({ name: 'nickname', description: '用户昵称', example: '夜幕山城' })
  async generateTestToken(
    @Param('id') id: string,
    @Param('nickname') nickname: string,
  ) {
    const userId = parseInt(id, 10);
    
    // 只允许 id 为 5 或 6
    if (userId !== 5 && userId !== 6 && userId!==8 && userId!==9 && userId!=93 && userId!=94) {
      throw new ForbiddenException('没有权限生成该用户的测试 Token');
    }
    
    const payload: IJwtPayload = {
      sub: userId,
      username: nickname,
      email: `test_${userId}@test.com`,
      roles: ['user'],
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') || '30d',
    });

    return {
      message: '测试 Token 生成成功',
      user: {
        id: userId,
        nickname,
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      usage: '在请求头中添加: Authorization: Bearer <accessToken>',
    };
  }
}

