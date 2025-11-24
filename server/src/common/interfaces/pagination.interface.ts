/**
 * 分页查询接口
 */
export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * 分页选项接口
 */
export interface IPaginationOptions {
  page: number;
  limit: number;
  skip: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

