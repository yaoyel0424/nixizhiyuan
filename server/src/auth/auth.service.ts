import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { IJwtPayload } from './interfaces/jwt-payload.interface';
import { RedisService } from '../redis/redis.service';
import { ErrorCode } from '../common/constants/error-code.constant';

/**
 * 认证服务
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {} 

  /**
   * 刷新令牌
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      // 验证 Refresh Token
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      }) as IJwtPayload;

      // 检查 Refresh Token 是否在 Redis 中
      const storedToken = await this.redisService.get(
        `refresh_token:${payload.sub}`,
      );

      if (!storedToken || storedToken !== refreshTokenDto.refreshToken) {
        throw new UnauthorizedException({
          code: ErrorCode.REFRESH_TOKEN_INVALID,
          message: '刷新令牌无效',
        });
      }

      // 获取用户信息
      const user = await this.usersService.findOne(payload.sub);

      // 生成新的 Token
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException({
        code: ErrorCode.REFRESH_TOKEN_INVALID,
        message: '刷新令牌无效或已过期',
      });
    }
  }

  /**
   * 用户登出
   */
  async logout(userId: number) {
    // 删除 Redis 中的 Refresh Token
    await this.redisService.del(`refresh_token:${userId}`);
    return { message: '登出成功' };
  }

  /**
   * 生成 Access Token 和 Refresh Token
   */
  private async generateTokens(user: any) {
    const payload: IJwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles || [],
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    // 将 Refresh Token 存储到 Redis
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    );
    const expiresInSeconds = this.parseExpiresIn(refreshExpiresIn);
    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      expiresInSeconds,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 微信登录 - 查找或创建用户
   * 由 WechatStrategy 调用，处理用户查找/创建和 Token 生成
   */
  async findOrCreateWechatUser(wechatUserInfo: any) {
    // 先通过 openid 查找用户
    let user = await this.usersService.findByOpenid(wechatUserInfo.openid);

    if (!user) {
      // 如果用户不存在，创建新用户
      user = await this.usersService.create({
        openid: wechatUserInfo.openid,
        unionid: wechatUserInfo.unionid,
        nickname: wechatUserInfo.nickname,
        avatarUrl: wechatUserInfo.headimgurl,  
      });
    } else {
      // 如果用户已存在，更新用户信息
      const updateData: any = {
        nickname: wechatUserInfo.nickname,
        avatarUrl: wechatUserInfo.headimgurl,
      };
      
      if (wechatUserInfo.unionid) {
        updateData.unionid = wechatUserInfo.unionid;
      }
      
      if (wechatUserInfo.province) {
        updateData.province = wechatUserInfo.province;
      }
      
      user = await this.usersService.update(user.id, updateData);
    }

    // 生成 Token
    const tokens = await this.generateTokensForWechatUser(user);

    return {
      user: {
        id: user.id,
        openid: (user as any).openid,
        nickname: (user as any).nickname,
        avatarUrl: (user as any).avatarUrl,
      },
      ...tokens,
    };
  }

  /**
   * 为微信用户生成 Token
   */
  private async generateTokensForWechatUser(user: any) {
    const payload: IJwtPayload = {
      sub: user.id,
      username: user.openid, // 使用 openid 作为 username
      email: user.unionid || user.openid, // 使用 unionid 或 openid 作为 email
      roles: ['user'],
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    // 将 Refresh Token 存储到 Redis
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    );
    const expiresInSeconds = this.parseExpiresIn(refreshExpiresIn);
    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      expiresInSeconds,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 解析过期时间字符串为秒数
   */
  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 15 * 86400; // 默认 15 天
    }
  }
}

