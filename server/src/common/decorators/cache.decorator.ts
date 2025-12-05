import { SetMetadata } from '@nestjs/common';

/**
 * 缓存配置元数据键
 */
export const CACHE_KEY = 'cache';
export const CACHE_TTL_KEY = 'cache_ttl';

/**
 * 缓存装饰器
 * 用于标记需要缓存的接口
 * @param ttl 缓存时效（秒），默认 600 秒（10分钟）
 * @example @Cache(600) // 缓存10分钟
 */
export const Cache = (ttl: number = 600) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY, true)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_KEY, ttl)(target, propertyKey, descriptor);
  };
};

