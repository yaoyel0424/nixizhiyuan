import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * 微信认证策略
 * 通过前端传入的 code 获取 token 和用户信息
 */
@Injectable()
export class WechatStrategy extends PassportStrategy(Strategy, 'wechat') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super();
  }

  /**
   * 验证微信登录
   * 从请求体中获取 code，然后通过 code 获取 token 和用户信息
   */
  async validate(req: Request): Promise<any> {
    const code = req.query?.code;
 
    if (!code) {
      throw new UnauthorizedException('微信授权码不能为空');
    }

    try {
      // 1. 通过 code 获取 access_token 和 openid
      const tokenData = await this.getWechatAccessToken(code as string);

      if (!tokenData.access_token || !tokenData.openid) {
        throw new UnauthorizedException(
          '微信授权失败：未获取到 access_token 或 openid',
        );
      }

      // 2. 通过 access_token 获取用户信息
      const userInfo = await this.getWechatUserInfo(
        tokenData.access_token,
        tokenData.openid,
      );

      // 3. 查找或创建用户，并生成 Token
      const result = await this.authService.findOrCreateWechatUser(userInfo);

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('微信登录失败');
    }
  }

  /**
   * 通过 code 获取微信 access_token
   */
  private async getWechatAccessToken(code: string): Promise<any> {
    // 读取微信配置（通过 registerAs('wechat', ...) 注册的配置）
    const appId = this.configService.get<string>('wechat.appId');
    const appSecret = this.configService.get<string>('wechat.appSecret');
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    try {
      const response = await fetch(tokenUrl);
      const data = await response.json();

      if (data.errcode) {
        throw new UnauthorizedException(
          `获取微信 access_token 失败: ${data.errmsg}`,
        );
      } 
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
        openid: data.openid,
        scope: data.scope,
        unionid: data.unionid,
      };

    } catch (error) {
      throw new UnauthorizedException('获取微信 access_token 失败');
    }
  }

  /**
   * 获取微信用户信息
   */
  private async getWechatUserInfo(
    accessToken: string,
    openid: string,
  ): Promise<any> {
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;
   
    try {
      const response = await fetch(userInfoUrl);
      const data = await response.json();
      console.log(data,accessToken,openid,"========")

      if (data.errcode) {
        throw new UnauthorizedException(
          `获取微信用户信息失败: ${data.errmsg}`,
        );
      }

      return {
        openid: data.openid,
        unionid: data.unionid,
        nickname: data.nickname,
        headimgurl: data.headimgurl,
        sex: data.sex,
        province: data.province,
        city: data.city,
        country: data.country,
      };
    } catch (error) {
      throw new UnauthorizedException('获取微信用户信息失败');
    }
  }
}

