import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@/entities/agent.entity';
import { User } from '@/entities/user.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { RedisService } from '@/redis/redis.service';

/** 创建代理商时默认分账比例 30% */
const DEFAULT_SPLIT_RATIO = 0.3;

/** 微信 access_token 缓存 key（与 content-security 共用同一 token） */
const WECHAT_ACCESS_TOKEN_KEY = 'wechat:access_token';

/** 小程序码接口 scene 最大 32 字符，UUID 去掉横线后为 32 字符 */
const SCENE_MAX_LEN = 32;

/**
 * 代理商服务
 * 负责代理商的创建与业务逻辑，以及基于 agent uuid 生成小程序码
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 按用户 ID 查询该用户归属的代理商（通过 user.agent_id，与创建者无关）
   * @param userId 用户ID
   * @returns 该用户归属的代理商或 null
   */
  async findByUserId(userId: number): Promise<Agent | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['agent'],
    });
    return user?.agent ?? null;
  }

  /**
   * 按创建者用户 ID 查询其创建的代理商（agent.user_id = 创建者）
   * @param userId 创建者用户ID
   * @returns 已存在的代理商或 null
   */
  async findByCreatorId(userId: number): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { userId } });
  }

  /**
   * 按 uuid 查询代理商
   * @param uuid UUID 标识符
   * @returns 代理商实体或 null
   */
  async findByUuid(uuid: string): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { uuid } });
  }

  /**
   * 获取微信 access_token（优先从 Redis 读取）
   */
  private async getWechatAccessToken(): Promise<string> {
    const appId = this.configService.get<string>('wechat.appId') || '';
    const appSecret = this.configService.get<string>('wechat.appSecret') || '';
    if (!appId || !appSecret) {
      throw new Error('微信配置缺失：请配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
    }
    const cached = await this.redisService.get(WECHAT_ACCESS_TOKEN_KEY);
    if (cached) return cached;
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(tokenUrl);
    const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number };
    if (data.errcode || !data.access_token) {
      throw new Error(`获取 access_token 失败: ${data.errmsg || data.errcode}`);
    }
    const ttl = Math.max((data.expires_in ?? 7200) - 300, 60);
    await this.redisService.set(WECHAT_ACCESS_TOKEN_KEY, data.access_token, ttl);
    return data.access_token;
  }

  /**
   * 根据当前用户 userId 从 agent 表获取代理商，再生成小程序码（PNG Buffer）
   * 内部在 page 后传入 uuid（当前用户 agent 的 uuid）用于识别用户的 agent
   * @param userId 当前用户 ID（从 CurrentUser 获取）
   * @param page 小程序页面路径
   * @returns PNG 图片 Buffer
   */
  async getMiniProgramQrcodeBufferByUserId(
    userId: number,
    page: string = 'pages/index/index',
  ): Promise<Buffer> {
    const agent = await this.findByUserId(userId);
    if (!agent) {
      throw new NotFoundException('当前用户未关联代理商，请先创建代理商');
    }
    page=`${page}?uuid=${agent.uuid}`;
    return this.getMiniProgramQrcodeBuffer(page, agent.uuid);
  }

  /**
   * 根据小程序页路径与代理商 uuid 生成进入小程序的小程序码（PNG 图片 Buffer）
   * 使用微信 getwxacodeunlimit 接口，scene 传 agent 的 uuid（去掉横线以符合 32 字符限制），用于识别用户的 agent
   * @param page 小程序页面路径，不填则进入首页
   * @param agentUuid 代理商 UUID（用于识别 agent）
   * @returns PNG 图片 Buffer
   */
  async getMiniProgramQrcodeBuffer(
    page: string = 'pages/index/index',
    agentUuid: string,
  ): Promise<Buffer> {
    const agent = await this.findByUuid(agentUuid);
    if (!agent) {
      throw new NotFoundException(`未找到 uuid=${agentUuid} 的代理商`);
    }
    const accessToken = await this.getWechatAccessToken();
    const scene = agentUuid.replace(/-/g, '').slice(0, SCENE_MAX_LEN);
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
    const body = JSON.stringify({ scene, page });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = JSON.parse(buf.toString()) as { errcode?: number; errmsg?: string };
      this.logger.warn(`微信生成小程序码失败: errcode=${err.errcode} errmsg=${err.errmsg}`);
      if (err.errcode === 40001) {
        await this.redisService.del(WECHAT_ACCESS_TOKEN_KEY);
      }
      throw new Error(`生成小程序码失败: ${err.errmsg || err.errcode}`);
    }
    return buf;
  }

  /**
   * 创建代理商（优先返回已存在的）
   * 按当前用户作为创建者查找是否已有代理商（agent.user_id），有则返回；无则新建。不修改 user.agent_id（归属关系独立）。
   * 不设置 openId；分账比例固定为 30%
   * @param dto 创建参数（type、name、phone、merchantId）
   * @param userId 当前用户 ID（作为创建者，从 CurrentUser 获取）
   * @returns 已有或新创建的代理商实体
   */
  async createOrGet(dto: CreateAgentDto, userId: number): Promise<Agent> {
    const existing = await this.findByCreatorId(userId);
    if (existing) {
      this.logger.log(`创建者 userId=${userId} 已有代理商，跳过创建 id=${existing.id}`);
      return existing;
    }
    const agent = this.agentRepository.create({
      type: dto.type,
      name: dto.name ?? '',
      phone: dto.phone ?? null,
      userId,
      merchantId: dto.merchantId ?? null,
      openid: null,
      splitRatio: DEFAULT_SPLIT_RATIO,
      status: 'active',
    });
    const saved = await this.agentRepository.save(agent);
    this.logger.log(`创建代理商成功 id=${saved.id} name=${saved.name} type=${saved.type}`);
    return saved;
  }
}
