import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { APP_CONSTANTS } from '../../common/constants/app.constant';

/**
 * 查询热门专业 DTO（分页、排序、筛选）
 */
export class QueryPopularMajorDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = APP_CONSTANTS.DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(APP_CONSTANTS.MAX_LIMIT)
  limit?: number = APP_CONSTANTS.DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  sortBy?: string = 'id';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  /**
   * 教育层次筛选（ben: 本科, zhuan: 专科, gao_ben: 高职本科）
   */
  @IsOptional()
  @IsString()
  @IsIn(['ben', 'zhuan', 'gao_ben'])
  level1?: string;

  /**
   * 专业名称搜索（模糊匹配）
   */
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 专业代码搜索
   */
  @IsOptional()
  @IsString()
  code?: string;
}

