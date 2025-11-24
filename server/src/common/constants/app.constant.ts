/**
 * 应用常量定义
 */
export const APP_CONSTANTS = {
  // 分页默认值
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // 请求超时时间（毫秒）
  REQUEST_TIMEOUT: 30000,

  // 文件上传限制
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],

  // 缓存过期时间（秒）
  CACHE_TTL: 3600, // 1小时

  // JWT Token 前缀
  TOKEN_PREFIX: 'Bearer ',
} as const;

