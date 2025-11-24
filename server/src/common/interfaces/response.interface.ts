/**
 * 统一响应接口定义
 */
export interface IResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  timestamp: string;
  path?: string;
}

/**
 * 分页元数据接口
 */
export interface IPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 分页响应接口
 */
export interface IPaginationResponse<T> {
  items: T[];
  meta: IPaginationMeta;
}

