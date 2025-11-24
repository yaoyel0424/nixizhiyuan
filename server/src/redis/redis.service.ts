import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { IRedisService } from './redis.interface';

/**
 * Redis 服务
 * 基于 node-redis 客户端实现
 */
@Injectable()
export class RedisService implements IRedisService, OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host') || 'localhost';
      const port = this.configService.get<number>('redis.port') || 6379;
      const password = this.configService.get<string>('redis.password');
      const db = this.configService.get<number>('redis.db') || 0;

      const redisConfig: any = {
        socket: {
          host,
          port,
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              console.error('Redis 连接失败，已重试 10 次');
              return new Error('Redis 连接失败');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      };

      if (password) {
        redisConfig.password = password;
      }

      if (db !== undefined) {
        redisConfig.database = db;
      }

      this.client = createClient(redisConfig);

      this.client.on('error', (err) => {
        console.error('Redis Client Error', err);
      });

      this.client.on('connect', () => {
        console.log('Redis 连接成功');
      });

      await this.client.connect();
    } catch (error) {
      console.error('Redis 初始化失败:', error);
      // 不抛出错误，允许应用继续运行（Redis 是可选的）
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.client.isOpen) {
      throw new Error('Redis 客户端未连接');
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client || !this.client.isOpen) {
      throw new Error('Redis 客户端未连接');
    }
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hGet(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hSet(key, field, value);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hDel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hGetAll(key);
  }

  /**
   * 获取 Redis 客户端实例（用于高级操作）
   */
  getClient(): RedisClientType {
    return this.client;
  }
}

