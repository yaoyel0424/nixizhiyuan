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
   * 从请求中获取 code 和用户信息，然后通过 code 获取 session_key 并解析用户信息
   */
  async validate(req: Request): Promise<any> {
    const code = req.query?.code || req.body?.code;
    const encryptedData = req.body?.encryptedData;
    const iv = req.body?.iv;
    const rawData = req.body?.rawData; // 原始 JSON 字符串，无需解密

    // 调试日志：检查接收到的数据
    console.log('微信登录请求数据:', {
      hasCode: !!code,
      hasRawData: !!rawData,
      hasEncryptedData: !!encryptedData,
      hasIv: !!iv,
      rawDataLength: rawData?.length || 0,
    });

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

      // 2. 初始化用户信息
      let userInfo: any = {
        openid: sessionData.openid,
        unionid: sessionData.unionid || undefined, // unionid 可能为空
      };

      // 3. 优先使用 rawData（无需解密，直接解析 JSON）
      if (rawData) {
        try {
          console.log('尝试解析 rawData:', rawData.substring(0, 100) + '...');
          const userData = JSON.parse(rawData);
          console.log('解析 rawData 成功，用户信息:', {
            nickName: userData.nickName,
            avatarUrl: userData.avatarUrl,
            unionId: userData.unionId,
          });
          userInfo = {
            ...userInfo,
            nickname: userData.nickName || userData.nickname,
            headimgurl: userData.avatarUrl || userData.avatar,
            sex: userData.gender || userData.sex,
            province: userData.province,
            city: userData.city,
            country: userData.country,
            // 如果 rawData 中有 unionId，优先使用（因为更可靠）
            unionid: userData.unionId || userData.unionid || userInfo.unionid,
          };
        } catch (error) {
          // 解析失败不影响登录
          console.warn('解析 rawData 失败:', error);
        }
      }
      // 4. 如果没有 rawData，尝试解密 encryptedData
      else if (encryptedData && iv) {
        try { 
          const decryptedData = this.decryptWechatData(
            encryptedData,
            iv,
            sessionData.session_key,
          );
          console.log('解密成功，用户信息:', {
            nickName: decryptedData.nickName,
            avatarUrl: decryptedData.avatarUrl,
            unionId: decryptedData.unionId,
          });
          userInfo = {
            ...userInfo,
            nickname: decryptedData.nickName || decryptedData.nickname,
            headimgurl: decryptedData.avatarUrl || decryptedData.headimgurl,
            sex: decryptedData.gender || decryptedData.sex,
            province: decryptedData.province,
            city: decryptedData.city,
            country: decryptedData.country,
            // 如果解密数据中有 unionId，优先使用（因为更可靠）
            unionid: decryptedData.unionId || decryptedData.unionid || userInfo.unionid,
          };
        } catch (error) {
          // 解密失败不影响登录，只是没有用户详细信息
          console.warn('解密用户信息失败:', error);
        }
      } else {
        console.warn('未接收到用户信息（rawData 或 encryptedData），只有 openid');
      }

      console.log('最终用户信息:', {
        openid: userInfo.openid,
        unionid: userInfo.unionid,
        nickname: userInfo.nickname,
        hasHeadimgurl: !!userInfo.headimgurl,
      }); 

      // 5. 查找或创建用户，并生成 Token
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

    // 验证配置是否存在
    if (!appId || !appSecret) {
      throw new UnauthorizedException(
        '微信配置缺失：请检查 WECHAT_APP_ID 和 WECHAT_APP_SECRET 环境变量',
      );
    }

    // 使用小程序登录接口 jscode2session
    const sessionUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await fetch(sessionUrl);
      const data = await response.json(); 
      if (data.errcode) {
        throw new UnauthorizedException(
          `获取微信 session 失败: url：${sessionUrl}，错误信息：${data.errmsg || data.errcode} (错误码: ${data.errcode})`,
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

