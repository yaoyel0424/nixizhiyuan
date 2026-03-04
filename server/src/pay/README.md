# 支付与分账模块

## 环境变量

在 `.env` 中配置：

- `WECHAT_APPID` 或 `WECHAT_APP_ID`：小程序/公众号 AppID
- `WX_PAY_MCHID`：微信支付商户号
- `WX_PAY_NOTIFY_URL`：支付结果回调地址（需公网可访问），如 `https://your-domain.com/api/v1/pay/notify`
- `WX_PAY_V3_KEY`：微信支付 APIv3 密钥（32 位）
- `WX_PAY_CERT_DIR`（可选）：证书目录，默认 `pay-key`

## 证书

将微信支付证书放在 `server/pay-key/`：

- `apiclient_cert.pem`
- `apiclient_key.pem`

## 收费逻辑（热门专业）

- **免费**：每用户可免费查看 **2 个**热门专业详情，用完后需付费。
- **按个付费**：每多查看 1 个热门专业 **29.9 元**，支付成功后记录该用户的「已付费专业 code」。
- **一次性解锁全部**：**299 元**解锁全部；若用户已为部分热门专业付过费，该金额从 299 元中**抵扣**（实付 = 299 − 已付热门专业总金额，最低 0；已解锁全部则不可重复购买）。

数据：`user_free_popular_major_records` 记录每用户使用免费权益的专业（每用户最多 2 条，即 2 个专业）；`user_entitlements` 记录已购「热门专业 code」或「解锁全部」。

## 接口

- **GET** `/api/v1/pay/transactions_jsapi`  
  创建 JSAPI 预支付订单。  
  - 按产品：`openid` + `productType=popular_major` + `majorCode` → 29.9 元/个；`productType=unlock_all` → 299 元（含抵扣）。  
  - 兼容：仅传 `openid` + `amount`（分）时按金额下单，不写权益 attach。

- **GET** `/api/v1/pay/can-view?openid=xxx&majorCode=xxx`  
  检查是否可查看该热门专业（不消耗免费额度），返回 `{ allowed, reason? }`。

- **GET** `/api/v1/pay/unlock-all-amount?openid=xxx`  
  获取「解锁全部」应付金额（分）及抵扣，返回 `{ amountCents, deductCents, hasUnlockAll }`。

- **GET** `/api/v1/pay/free-quota?openid=xxx`  
  查询免费额度使用情况，返回 `{ used, total, remaining, usedAll }`。`usedAll === true` 表示已用完两个免费额度。

- **POST** `/api/v1/pay/notify`  
  微信支付回调（由微信服务器调用）。解密后入队、落库订单，并根据 attach 写入 `user_entitlements`。

- **POST** `/api/v1/pay/notify/split`  
  **分账动账通知**（微信服务器调用）。需在商户平台配置分账回调 URL。解密后根据 `out_order_no`（本系统为 `S{order_id}`）更新订单 `split_status`、`split_at`。应答需返回 `{ code: 'SUCCESS', message: '成功' }`，否则微信会按策略重试（约 24 小时内）。

- **POST** `/api/v1/pay/split/receiver`  
  **手工添加分账接收方**（需登录态）。请求体：`type`（PERSONAL_OPENID / MERCHANT_ID）、`account`（openid 或商户号）、可选 `relationType`（默认 SERVICE_PROVIDER）、`customRelation`（relationType 为 CUSTOM 时）。接收方已存在时视为成功。详见 `分账问题与排查.md`。

## 异步流程

1. **支付回调** → 解密成功 → 投递到 `payment` 队列 → 返回 200。
2. **PaymentProcessor**：  
   - 使用 Redis `pay:notify:done:{transaction_id}` 做幂等；  
   - 落库订单（Order）；  
   - 若订单带 `agent_id`/`agent_amount`（可从 attach JSON 解析），则投递到 `split` 队列。
3. **SplitProcessor**：  
   - 幂等：仅当分账**成功**时写入 Redis `split:request:done:{transaction_id}`（失败不写，便于 BullMQ 重试）；  
   - 调用微信分账 API（`PayService.createProfitsharingOrders`）；  
   - 成功则更新订单 `split_status=success`、`split_at`；失败则 `split_status=failed` 并 **rethrow**，由 BullMQ 按配置重试（默认 3 次、指数退避）。  
   - 入队时使用 `jobId: transaction_id`、`attempts: 3`、`backoff: { type: 'exponential', delay: 5000 }`。

## 分账失败与回调

- **失败处理**：SplitProcessor 调用微信分账失败时会保存订单 `split_status=failed` 并 **抛出异常**，BullMQ 会自动重试（最多 3 次、指数退避）。幂等键仅在分账成功时写入，因此重试会再次请求微信。
- **分账回调**：微信会向商户配置的**分账动账通知 URL** 发送 `PROFITSHARING` / `PROFITSHARING_RETURN` 事件。本模块提供 `POST /api/v1/pay/notify/split`，解密后根据 `out_order_no` 更新订单分账状态。若未收到回调，可主动调用「查询分账结果」接口核对。

## 分账与 attach

下单时可在 `attach` 传入 JSON，例如：

```json
{
  "agentId": 1,
  "agentOpenid": "用户 openid",
  "agentAmount": 100,
  "platformAmount": 50
}
```

- `agentAmount` / `platformAmount` 单位：分。  
- 分账接收方列表由 `PaymentProcessor.buildReceivers` 根据订单与 attach 生成；个人分账需提供 `agentOpenid`。

## 依赖

- **wechatpay-node-v3**（npm 包名，v2.2.1）：微信支付 V3 SDK，源码仓库 [klover2/wechatpay-node-v3-ts](https://github.com/klover2/wechatpay-node-v3-ts)。提供 JSAPI 下单、回调解密、分账等接口。
- Redis：队列与幂等键（与现有 Redis 配置一致）。
- BullMQ：队列 `payment`、`split`，使用同一 Redis。
