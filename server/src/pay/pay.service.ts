import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { customAlphabet } from 'nanoid';
import type { WxPayResult, WxPayNotifyBody } from './pay.types';
import { PayLoggerService } from './pay-logger.service';

// 微信支付 V3 SDK（来源 https://github.com/klover2/wechatpay-node-v3-ts ，npm 包名 wechatpay-node-v3，最新 v2.2.1）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WxPay = require('wechatpay-node-v3');

/** 生成 32 位数字商户订单号 */
const genOutTradeNo = customAlphabet('1234567890', 32);

/** 平台证书缓存有效期（毫秒），微信建议 12 小时内更新 */
const PLATFORM_CERT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class PayService implements OnModuleInit {
  private wxPay: any;
  private v3Key: string = '';
  private notifyUrl: string = '';
  /** 自建拉取证书用：商户号、商户私钥 PEM、商户证书序列号（hex 大写） */
  private certMchid: string = '';
  private certPrivateKeyPem: string = '';
  private certMerchantSerialNo: string = '';
  /** 微信平台证书缓存，避免每次分账都拉取证书（拉取失败会导致分账全部失败） */
  private platformCertCache: { certificate: any; expiryAt: number } | null = null;
  /** 微信支付公钥 ID（公钥模式），配置后分账等接口使用此值作为 Wechatpay-Serial，不再拉取平台证书 */
  private wxPubKeyId: string = '';

  constructor(
    private configService: ConfigService,
    private readonly logger: PayLoggerService,
  ) {}

  onModuleInit() {
    const appid =
      this.configService.get<string>('pay.appid') ||
      this.configService.get<string>('wechat.appId') ||'';
    const mchid = this.configService.get<string>('pay.mchid') || '';
    this.notifyUrl = this.configService.get<string>('pay.notifyUrl') || '';
    this.v3Key = this.configService.get<string>('pay.v3Key') || '';
    this.wxPubKeyId = (this.configService.get<string>('pay.wxPubKeyId') || '').trim();
    const certDir = this.configService.get<string>('pay.certDir') || 'pay-key';
    const certPath = path.isAbsolute(certDir)
      ? certDir
      : path.join(process.cwd(), certDir);

    if (!appid || !mchid || !this.v3Key || !this.notifyUrl) {
      this.logger.warn(
        '微信支付配置不完整，Pay 模块将不可用。请配置 pay.appid / pay.mchid / pay.v3Key / pay.notifyUrl',
      );
      return;
    }

    const publicKeyPath = path.join(certPath, 'apiclient_cert.pem');
    const privateKeyPath = path.join(certPath, 'apiclient_key.pem');
    if (!fs.existsSync(publicKeyPath) || !fs.existsSync(privateKeyPath)) {
      this.logger.warn(
        `微信支付证书不存在: ${publicKeyPath} 或 ${privateKeyPath}`,
      );
      return;
    }

    try {
      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
      this.certPrivateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
      this.certMchid = mchid;
      // 商户证书序列号（hex 大写），用于自建 GET /v3/certificates 的 Authorization
      const x509 = new crypto.X509Certificate(publicKeyPem);
      this.certMerchantSerialNo = x509.serialNumber.toUpperCase().replace(/:/g, '');
      this.wxPay = new WxPay({
        appid,
        mchid,
        publicKey: publicKeyPem,
        privateKey: this.certPrivateKeyPem,
      });
      this.logger.log('微信支付 Pay 模块初始化成功');
      if (this.wxPubKeyId) {
        this.logger.log(`分账使用微信支付公钥模式 wxPubKeyId=${this.wxPubKeyId}`);
      }
    } catch (e) {
      this.logger.error('微信支付初始化失败', e);
    }
  }

  /**
   * 创建 JSAPI 预支付订单，返回前端调起支付所需参数
   * @param attach 可选，附加数据（如 productType、majorCode），回调时会原样带回
   */
  async createJsapiPrepay(
    openid: string,
    amountTotal: number,
    clientIp: string,
    description: string = '逆袭智愿',
    attach?: string,
  ): Promise<{ prepay_id?: string; [key: string]: any }> {
    if (!this.wxPay) {
      throw new Error('微信支付未正确初始化，请检查配置与证书');
    }
    const appid =
      this.configService.get<string>('pay.appid') ||
      this.configService.get<string>('wechat.appId');
    const params: Record<string, any> = {
      description,
      out_trade_no: genOutTradeNo(),
      appid: appid!,
      notify_url: this.notifyUrl,
      amount: { total: amountTotal },
      payer: { openid },
      scene_info: { payer_client_ip: clientIp },
    };
    if (attach != null && attach !== '') {
      params.attach = attach;
    }
    const result = await this.wxPay.transactions_jsapi(params);
    return result;
  }

  /**
   * 解密支付成功回调中的 resource，返回订单结果
   */
  decryptNotify(body: WxPayNotifyBody): WxPayResult | null {
    if (!this.wxPay || !this.v3Key) return null;
    if (
      body?.event_type !== 'TRANSACTION.SUCCESS' ||
      body?.resource_type !== 'encrypt-resource'
    ) {
      return null;
    }
    const { ciphertext, associated_data, nonce } = body.resource;
    try {
      const result = this.wxPay.decipher_gcm(
        ciphertext,
        associated_data,
        nonce,
        this.v3Key,
      ) as WxPayResult;
      return result;
    } catch (e) {
      this.logger.error('解密支付回调失败', e);
      return null;
    }
  }

  getWxPay(): any {
    return this.wxPay;
  }

  /**
   * 解密微信回调中的 resource（支付、分账等通用）
   * @returns 解密后的 JSON 对象，失败返回 null
   */
  decryptResource(
    ciphertext: string,
    associatedData: string,
    nonce: string,
  ): Record<string, any> | null {
    if (!this.wxPay || !this.v3Key) return null;
    try {
      return this.wxPay.decipher_gcm(
        ciphertext,
        associatedData,
        nonce,
        this.v3Key,
      ) as Record<string, any>;
    } catch (e) {
      this.logger.error('resource 解密失败', e);
      return null;
    }
  }

  /**
   * 自建请求 GET /v3/certificates，按官方文档签名（body 为空时结尾 \\n\\n），便于拿到真实错误信息
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012551764
   */
  private async fetchPlatformCertificatesDirect(): Promise<Array<{ serial_no: string; [k: string]: any }>> {
    const urlPath = '/v3/certificates';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    // GET 请求 body 为空时，签名字符串最后一行仍须保留换行，即结尾为 \n\n
    const signStr = `GET\n${urlPath}\n${timestamp}\n${nonce}\n\n`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const signature = sign.sign(this.certPrivateKeyPem, 'base64');
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.certMchid}",serial_no="${this.certMerchantSerialNo}",nonce_str="${nonce}",timestamp="${timestamp}",signature="${signature}"`;

    const hosts = ['api.mch.weixin.qq.com', 'api2.mch.weixin.qq.com'];
    let lastError: Error | null = null;
    for (const host of hosts) {
      try {
        const { status, body: bodyText } = await this.httpsGet(host, urlPath, {
          Accept: 'application/json',
          'User-Agent': 'Nixizhiyuan-Pay/1.0',
          Authorization: authorization,
        });
        if (status !== 200) {
          let errDetail = `status=${status} body=${bodyText.slice(0, 500)}`;
          try {
            const errJson = JSON.parse(bodyText) as { code?: string; message?: string };
            if (errJson.code) errDetail += ` code=${errJson.code} message=${errJson.message ?? ''}`;
          } catch {
            // ignore
          }
          this.logger.error(`拉取平台证书失败(${host}) ${errDetail}`);
          lastError = new Error(`拉取平台证书失败: ${status} ${bodyText.slice(0, 200)}`);
          continue;
        }
        const json = JSON.parse(bodyText) as { data?: Array<{ serial_no: string; [k: string]: any }> };
        const data = json?.data;
        if (!Array.isArray(data) || data.length === 0) {
          this.logger.error('拉取平台证书失败：返回 data 为空');
          throw new Error('获取微信平台证书失败：返回列表为空');
        }
        return data;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const code = e?.code;
        this.logger.error(`拉取平台证书请求异常(${host}) errCode=${code ?? '-'} ${msg}`);
        lastError = e instanceof Error ? e : new Error(msg);
      }
    }
    throw lastError ?? new Error('拉取平台证书失败');
  }

  /**
   * 使用 https 发起 GET，仅发送指定 headers（不送 Accept-Language，避免微信 406）
   */
  private httpsGet(
    host: string,
    path: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host,
          path,
          method: 'GET',
          headers: { ...headers, Host: host },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * 获取分账等接口所需的“证书序列号”（供请求头 Wechatpay-Serial）
   * 若已配置微信支付公钥 ID（公钥模式），直接返回该 ID；否则拉取平台证书并返回其 serial_no
   */
  private async getPlatformCertificate(): Promise<{ serial_no: string; publicKey?: any; [k: string]: any }> {
    const pubKeyId = this.wxPubKeyId || (process.env.WX_PAY_PUB_KEY_ID || '').trim();
    if (pubKeyId) {
      return { serial_no: pubKeyId };
    }
    const now = Date.now();
    if (this.platformCertCache && this.platformCertCache.expiryAt > now) {
      return this.platformCertCache.certificate;
    }
    if (!this.certPrivateKeyPem || !this.certMerchantSerialNo) {
      throw new Error('微信支付证书未初始化，且未配置 WX_PAY_PUB_KEY_ID，无法获取 Wechatpay-Serial');
    }
    const data = await this.fetchPlatformCertificatesDirect();
    const chosen = data[data.length - 1];
    const certificate = { serial_no: chosen.serial_no };
    this.platformCertCache = {
      certificate,
      expiryAt: now + PLATFORM_CERT_CACHE_TTL_MS,
    };
    this.logger.log(`微信平台证书已拉取并缓存 serial_no=${chosen.serial_no}`);
    return certificate;
  }

  /**
   * 请求微信分账（wechatpay-node-v3 create_profitsharing_orders）
   * @param transactionId 微信支付订单号
   * @param outOrderNo 商户分账单号（需唯一）
   * @param receivers 分账接收方，与 SplitJobPayload.receivers 结构一致
   */
  async createProfitsharingOrders(
    transactionId: string,
    outOrderNo: string,
    receivers: Array<{ type: string; account?: string; openid?: string; amount: number; description: string }>,
  ): Promise<any> {
    if (!this.wxPay || !this.v3Key) {
      throw new Error('微信支付未初始化或未配置 APIv3 密钥');
    }
    if (!receivers || receivers.length === 0) {
      throw new Error('分账接收方不能为空');
    }
    const certificate = await this.getPlatformCertificate();
    const wxReceivers = receivers.map((r) => {
      const base: Record<string, any> = {
        type: r.type,
        amount: r.amount,
        description: r.description,
      };
      if (r.type === 'PERSONAL_OPENID' && r.openid) {
        base.openid = r.openid;
      } else if ((r.type === 'MERCHANT_ID' || r.type === 'MERCHANT') && r.account) {
        base.account = r.account;
      }
      return base;
    });
    const res = await this.wxPay.create_profitsharing_orders({
      transaction_id: transactionId,
      out_order_no: outOrderNo,
      receivers: wxReceivers,
      unfreeze_unsplit: true,
      wx_serial_no: certificate.serial_no,
    });
    return res;
  }
}
