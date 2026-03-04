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
  /** 商户 appid，添加 PERSONAL_OPENID 分账接收方时必填 */
  private appid: string = '';
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
      this.appid = appid;
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
      // 分账订单需传 settle_info.profit_sharing，不能传 body 顶层 profit_sharing（会报「未在API文档中定义的参数」）
      settle_info: { profit_sharing: true },
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
   * 查询分账结果（普通商户，符合官方文档）
   * 请求：GET /v3/profitsharing/orders/{out_order_no}?transaction_id=xxx
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012525210
   * @returns 统一带 status 字段（来自接口 state），便于下游判断：PROCESSING | FINISHED | CLOSED 等
   */
  async queryProfitsharingOrder(
    transactionId: string,
    outOrderNo: string,
  ): Promise<{ status: string; order_id?: string; receivers?: any[]; [k: string]: any } | null> {
    if (!this.certPrivateKeyPem || !this.certMerchantSerialNo) {
      this.logger.warn('微信支付证书未初始化，无法查询分账结果');
      return null;
    }
    // 官方文档：out_order_no 为路径参数，transaction_id 为 query 参数
    const pathSegment = encodeURIComponent(outOrderNo);
    const urlPath = `/v3/profitsharing/orders/${pathSegment}?transaction_id=${encodeURIComponent(transactionId)}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signStr = `GET\n${urlPath}\n${timestamp}\n${nonce}\n\n`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const signature = sign.sign(this.certPrivateKeyPem, 'base64');
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.certMchid}",serial_no="${this.certMerchantSerialNo}",nonce_str="${nonce}",timestamp="${timestamp}",signature="${signature}"`;

    const host = 'api.mch.weixin.qq.com';
    this.logger.log(`[queryProfitsharingOrder] 请求 GET https://${host}${urlPath}`);
    const { status, body: bodyText } = await this.httpsGet(host, urlPath, {
      Accept: 'application/json',
      'User-Agent': 'Nixizhiyuan-Pay/1.0',
      Authorization: authorization,
    });
    if (status !== 200) {
      this.logger.warn(
        `查询分账结果失败 status=${status} transaction_id=${transactionId} bodyLen=${bodyText.length} body=${bodyText.slice(0, 500)}`,
      );
      return null;
    }
    try {
      const data = JSON.parse(bodyText) as {
        state?: string;
        status?: string;
        order_id?: string;
        receivers?: any[];
        [k: string]: any;
      };
      // 官方返回字段为 state（PROCESSING/FINISHED），下游统一用 status
      const status = data.status ?? data.state ?? '';
      return { ...data, status };
    } catch {
      return null;
    }
  }

  /**
   * 添加分账接收方（请求分账前需先添加，PERSONAL_OPENID 时必填 appid）
   * 若接收方已存在（RECEIVER_EXIST）则视为成功，不抛错
   * @param type 接收方类型，如 PERSONAL_OPENID、MERCHANT_ID
   * @param account 接收方账号（openid 或商户号）
   * @param relationType 关系类型，默认 SERVICE_PROVIDER；可选 CUSTOM 时需传 customRelation
   * @param customRelation relation_type 为 CUSTOM 时的自定义关系说明
   */
  async addProfitsharingReceiver(
    type: string,
    account: string,
    relationType: string = 'SERVICE_PROVIDER',
    customRelation?: string,
  ): Promise<void> {
    if (!this.wxPay) {
      throw new Error('微信支付未初始化，无法添加分账接收方');
    }
    const relation_type =
      this.configService.get<string>('pay.profitsharingRelationType') || relationType;
    const custom_relation =
      this.configService.get<string>('pay.profitsharingCustomRelation') || customRelation;
    const body: Record<string, any> = {
      appid: this.appid,
      type,
      account,
      relation_type,
    };
    if (relation_type === 'CUSTOM' && custom_relation) {
      body.custom_relation = custom_relation;
    }
    const res = await this.wxPay.profitsharing_receivers_add(body);
    const status = res?.status ?? res?.errRaw?.response?.status;
    if (typeof status === 'number' && status >= 400) {
      let code = '';
      let message = res?.error;
      if (typeof message === 'string') {
        try {
          const parsed = JSON.parse(message) as { code?: string; message?: string };
          code = parsed.code ?? '';
          message = parsed.message ?? message;
        } catch {
          // 保持原始
        }
      }
      // 接收方已存在时视为成功，幂等
      if (code === 'RECEIVER_EXIST' || (typeof message === 'string' && message.includes('已存在'))) {
        this.logger.log(`[addProfitsharingReceiver] 接收方已存在 type=${type} account=${account}`);
        return;
      }
      this.logger.warn(
        `[addProfitsharingReceiver] 添加失败 status=${status} type=${type} account=${account} error=${message}`,
      );
      throw new Error(message ?? `添加分账接收方失败 status=${status}`);
    }
    this.logger.log(`[addProfitsharingReceiver] 添加成功 type=${type} account=${account}`);
  }

  /**
   * 请求微信分账（wechatpay-node-v3 create_profitsharing_orders）
   * 对 PERSONAL_OPENID 接收方会先调用添加分账接收方再发起分账
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
    // 先添加分账接收方（PERSONAL_OPENID 必须先添加关系，否则分账会报 PARAM_ERROR）
    for (const r of receivers) {
      if (r.type === 'PERSONAL_OPENID' && r.openid) {
        await this.addProfitsharingReceiver('PERSONAL_OPENID', r.openid);
      }
    }
    const certificate = await this.getPlatformCertificate();
    const wxReceivers = receivers.map((r) => {
      const base: Record<string, any> = {
        type: r.type,
        amount: r.amount,
        description: r.description,
      };
      // 文档要求：接收方统一用 account。PERSONAL_OPENID 时 account 填 openid 值，MERCHANT_ID 时填商户号
      if (r.type === 'PERSONAL_OPENID' && r.openid) {
        base.account = r.openid;
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

    // wechatpay-node-v3 在 HTTP 4xx/5xx 时不抛错，返回 { status, error }，需主动判断并抛错
    const status = res?.status ?? (res?.errRaw?.response?.status);
    if (typeof status === 'number' && status >= 400) {
      let msg = res?.error;
      if (typeof msg === 'string') {
        try {
          const parsed = JSON.parse(msg) as { code?: string; message?: string };
          msg = parsed.message ? `${parsed.code ?? ''}: ${parsed.message}` : msg;
        } catch {
          // 保持原始 error 字符串
        }
      }
      this.logger.warn(
        `[createProfitsharingOrders] 请求失败 status=${status} transaction_id=${transactionId} out_order_no=${outOrderNo} error=${msg ?? res?.error}`,
      );
      throw new Error(msg ?? `分账请求失败 status=${status}`);
    }

    const orderId = res?.order_id ?? (res as any)?.orderId ?? '';
    const state = res?.state ?? (res as any)?.order_state ?? '';
    this.logger.log(
      `[createProfitsharingOrders] 请求成功 transaction_id=${transactionId} out_order_no=${outOrderNo} order_id=${orderId} state=${state}`,
    );
    return res;
  }
}
