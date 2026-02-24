import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { customAlphabet } from 'nanoid';
import type { WxPayResult, WxPayNotifyBody } from './pay.types';
import { PayLoggerService } from './pay-logger.service';

// 微信支付 V3 SDK（来源 https://github.com/klover2/wechatpay-node-v3-ts ，npm 包名 wechatpay-node-v3，最新 v2.2.1）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WxPay = require('wechatpay-node-v3');

/** 生成 32 位数字商户订单号 */
const genOutTradeNo = customAlphabet('1234567890', 32);

@Injectable()
export class PayService implements OnModuleInit {
  private wxPay: any;
  private v3Key: string = '';
  private notifyUrl: string = '';

  constructor(
    private configService: ConfigService,
    private readonly logger: PayLoggerService,
  ) {}

  onModuleInit() {
    const appid =
      this.configService.get<string>('pay.appid') ||
      this.configService.get<string>('wechat.appId') ||
      '';
    const mchid = this.configService.get<string>('pay.mchid') || '';
    this.notifyUrl = this.configService.get<string>('pay.notifyUrl') || '';
    this.v3Key = this.configService.get<string>('pay.v3Key') || '';
    const certDir =
      this.configService.get<string>('pay.certDir') || 'pay-key';
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
      this.wxPay = new WxPay({
        appid,
        mchid,
        publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
        privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
      });
      this.logger.log('微信支付 Pay 模块初始化成功');
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
    const certificates = await this.wxPay.get_certificates(this.v3Key);
    if (!certificates || certificates.length === 0) {
      throw new Error('获取微信平台证书失败');
    }
    const certificate = certificates[certificates.length - 1];
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
