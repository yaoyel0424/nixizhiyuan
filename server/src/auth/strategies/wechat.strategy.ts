import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import * as crypto from 'crypto';

/**
 * 微信认证策略
 * 通过前端传入的 code 获取 session_key 和 openid，并解密用户信息
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
   * 从请求中获取 code 和加密的用户信息，然后通过 code 获取 session_key 并解密用户信息
   */
  async validate(req: Request): Promise<any> {
    const code = req.query?.code || req.body?.code;
    const encryptedData = req.body?.encryptedData;
    const iv = req.body?.iv;

    if (!code) {
      throw new UnauthorizedException('微信授权码不能为空');
    }

    try {
      // 1. 通过 code 获取 session_key 和 openid（小程序登录接口）
      const sessionData = await this.getWechatSession(code as string);

      if (!sessionData.openid || !sessionData.session_key) {
        throw new UnauthorizedException(
          '微信授权失败：未获取到 openid 或 session_key',
        );
      }

      // 2. 如果有加密数据，解密用户信息
      let userInfo: any = {
        openid: sessionData.openid,
        unionid: sessionData.unionid,
      };

      if (encryptedData && iv) {
        try {
          const decryptedData = this.decryptWechatData(
            encryptedData,
            iv,
            sessionData.session_key,
          );
          userInfo = {
            ...userInfo,
            nickname: decryptedData.nickName || decryptedData.nickname,
            headimgurl: decryptedData.avatarUrl || decryptedData.headimgurl,
            sex: decryptedData.gender || decryptedData.sex,
            province: decryptedData.province,
            city: decryptedData.city,
            country: decryptedData.country,
          };
        } catch (error) {
          // 解密失败不影响登录，只是没有用户详细信息
          console.warn('解密用户信息失败:', error);
        }
      }

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
   * 通过 code 获取微信 session_key 和 openid（小程序登录接口）
   */
  private async getWechatSession(code: string): Promise<any> {
    const appId = this.configService.get<string>('wechat.appId');
    const appSecret = this.configService.get<string>('wechat.appSecret');
    // 使用小程序登录接口 jscode2session
    const sessionUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await fetch(sessionUrl);
      const data = await response.json();

      if (data.errcode) {
        throw new UnauthorizedException(
          `获取微信 session 失败: ${data.errmsg || data.errcode}`,
        );
      }

      return {
        openid: data.openid,
        session_key: data.session_key,
        unionid: data.unionid,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('获取微信 session 失败');
    }
  }

  /**
   * 解密微信小程序加密数据
   * @param encryptedData 加密数据
   * @param iv 初始向量
   * @param sessionKey 会话密钥
   */
  private decryptWechatData(
    encryptedData: string,
    iv: string,
    sessionKey: string,
  ): any {
    try {
      // Base64 解码
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');
      const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');

      // AES-128-CBC 解密
      const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        sessionKeyBuffer,
        ivBuffer,
      );

      let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      // 解析 JSON
      const data = JSON.parse(decrypted);

      // 验证 appid（可选，增加安全性）
      const appId = this.configService.get<string>('wechat.appId');
      if (data.watermark && data.watermark.appid !== appId) {
        throw new UnauthorizedException('解密数据 appid 不匹配');
      }

      return data;
    } catch (error) {
      throw new UnauthorizedException('解密用户信息失败');
    }
  }
}

