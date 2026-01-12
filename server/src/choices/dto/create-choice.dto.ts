import { IsOptional, IsString, IsInt, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdTransformUtil } from '@/common/utils/id-transform.util';

/**
 * 专业分数项 DTO（用于验证 majorScores 数组中的每个对象）
 */
export class MajorScoreItemDto {
  @IsOptional()
  @IsString()
  schoolCode?: string;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  year?: string | null;

  @IsOptional()
  @IsString()
  subjectSelectionMode?: string | null;

  @IsOptional()
  @IsString()
  batch?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    // 如果是字符串，尝试转换为数字
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return typeof value === 'number' ? value : null;
  })
  minScore?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    // 如果是字符串，尝试转换为整数
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    }
    return typeof value === 'number' ? Math.floor(value) : null;
  })
  @IsInt()
  minRank?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    // 如果是字符串，尝试转换为数字
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return typeof value === 'number' ? value : null;
  })
  admitCount?: number | null;

  @IsOptional()
  @IsString()
  enrollmentType?: string | null;
}

/**
 * 创建志愿的请求 DTO
 */
export class CreateChoiceDto {
  /**
   * 专业组ID
   */
  @ApiPropertyOptional({ description: '专业组ID', example: 12345 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    // 先转换为数字，然后解码
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numValue)) return null;
    return IdTransformUtil.decode(numValue);
  })
  @IsInt()
  mgId?: number | null;

  /**
   * 学校代码
   */
  @ApiPropertyOptional({ description: '学校代码', example: '10001' })
  @IsOptional()
  @IsString()
  schoolCode?: string | null;

  /**
   * 招生专业（专业名称）
   */
  @ApiPropertyOptional({ description: '招生专业（专业名称）', example: '计算机科学与技术' })
  @IsOptional()
  @IsString()
  enrollmentMajor?: string | null;

  /**
   * 批次
   */
  @ApiPropertyOptional({ description: '批次', example: '本科批' })
  @IsOptional()
  @IsString()
  batch?: string | null;

  /**
   * 排名
   */
  @ApiPropertyOptional({ description: '排名', example: 5000 })
  @IsOptional()
  @IsInt()
  rank?: number | null;

  /**
   * 专业组信息
   */
  @ApiPropertyOptional({ description: '专业组信息', example: '首选物理，再选不限' })
  @IsOptional()
  @IsString()
  majorGroupInfo?: string | null;

  /**
   * 选科模式
   */
  @ApiPropertyOptional({ description: '选科模式', example: '物理类' })
  @IsOptional()
  @IsString()
  subjectSelectionMode?: string | null;

  /**
   * 学制
   */
  @ApiPropertyOptional({ description: '学制', example: '四年' })
  @IsOptional()
  @IsString()
  studyPeriod?: string | null;

  /**
   * 招生计划数
   */
  @ApiPropertyOptional({ description: '招生计划数', example: '50' })
  @IsOptional()
  @IsString()
  enrollmentQuota?: string | null;

  /**
   * 备注
   */
  @ApiPropertyOptional({ description: '备注', example: '备注信息' })
  @IsOptional()
  @IsString()
  remark?: string | null;

  /**
   * 学费
   */
  @ApiPropertyOptional({ description: '学费', example: '5000' })
  @IsOptional()
  @IsString()
  tuitionFee?: string | null;

  /**
   * 货币单位
   */
  @ApiPropertyOptional({ description: '货币单位', example: '元/年' })
  @IsOptional()
  @IsString()
  curUnit?: string | null;

  /**
   * 专业分数数组（JSON格式）
   */
  @ApiPropertyOptional({
    description: '专业分数数组（JSON格式）',
    example: [
      {
        schoolCode: '1299',
        province: '江苏',
        year: '2023',
        subjectSelectionMode: '物理类',
        batch: '本科批',
        minScore: '506.00',
        minRank: 121516,
        admitCount: null,
        enrollmentType: '普通类',
      },
      {
        schoolCode: '1299',
        province: '江苏',
        year: '2024',
        subjectSelectionMode: '物理类',
        batch: '本科批',
        minScore: '519.00',
        minRank: 120389,
        admitCount: null,
        enrollmentType: '普通类',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MajorScoreItemDto)
  majorScores?: MajorScoreItemDto[] | null;
}
