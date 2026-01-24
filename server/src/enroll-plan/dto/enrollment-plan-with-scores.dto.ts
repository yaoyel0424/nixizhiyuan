import { Expose, Type, Transform, Exclude } from 'class-transformer';
import { IdTransformUtil } from '@/common/utils/id-transform.util';

/**
 * 简化的学校信息 DTO（包含招生率和就业率）
 */
export class SchoolSimpleDto {
  @Expose()
  code: string;

  @Expose()
  name: string;

  @Expose()
  nature: string;

  @Expose()
  level: string;

  @Expose()
  belong: string;

  @Expose()
  categories: string;

  @Expose()
  features: string;

  @Expose()
  provinceName: string;

  @Expose()
  cityName: string;

  @Expose()
  enrollmentRate: number | null;

  @Expose()
  employmentRate: number | null;
}

/**
 * 简化的学校详情 DTO
 */
export class SchoolDetailSimpleDto {
  @Expose()
  code: string;

  @Expose()
  enrollmentRate: number | null;

  @Expose()
  employmentRate: number | null;
}

/**
 * 简化的专业组信息 DTO
 */
export class MajorGroupSimpleDto {
  @Expose()
  schoolCode: string;

  @Expose()
  province: string | null;

  @Expose()
  year: string | null;

  @Expose()
  subjectSelectionMode: string | null;

  @Expose()
  batch: string | null;

  @Exclude({ toPlainOnly: true })
  mgId: number | null;

  @Expose()
  mgName: string | null;

  @Expose()
  mgInfo: string | null;
}

/**
 * 简化的专业分数信息 DTO
 */
export class MajorScoreSimpleDto {
  @Expose()
  schoolCode: string;

  @Expose()
  province: string | null;

  @Expose()
  year: string | null;

  @Expose()
  subjectSelectionMode: string | null;

  @Expose()
  batch: string | null;

  @Expose()
  minScore: number | null;

  @Expose()
  minRank: number | null;

  @Expose()
  admitCount: number | null;

  @Expose()
  enrollmentType: string | null;

  @Expose()
  rankDiff: string;
}

/**
 * 招生计划项 DTO（按 enrollmentMajor 和 remark 分组）
 */
export class EnrollmentPlanItemDto {
  @Expose()
  id: number;

  @Expose()
  schoolCode: string;

  @Expose()
  @Transform(({ value }) => IdTransformUtil.encode(value))
  majorGroupId: number | null;

  @Expose()
  majorGroupInfo: string | null;

  @Expose()
  province: string | null;

  @Expose()
  year: string | null;

  @Expose()
  batch: string | null;

  @Expose()
  subjectSelectionMode: string | null;

  @Expose()
  studyPeriod: string | null;

  @Expose()
  enrollmentQuota: string | null;

  @Expose()
  enrollmentType: string | null;

  @Expose()
  remark: string | null;

  @Expose()
  tuitionFee: string | null;

  @Expose()
  enrollmentMajor: string | null;

  @Expose()
  curUnit: string | null;

  @Expose()
  @Type(() => MajorGroupSimpleDto)
  majorGroup: MajorGroupSimpleDto | null;

  @Expose()
  @Type(() => MajorScoreSimpleDto)
  majorScores: MajorScoreSimpleDto[];
}

/**
 * 按学校分组的招生计划 DTO
 */
export class EnrollmentPlanWithScoresDto {
  @Expose()
  @Type(() => SchoolSimpleDto)
  school: SchoolSimpleDto;

  @Expose()
  @Type(() => EnrollmentPlanItemDto)
  plans: EnrollmentPlanItemDto[];
}

/**
 * 分数段分组返回 DTO（返回两个数组：满足分数段 / 不满足分数段）
 * 说明：
 * - 同一学校如果同时存在满足与不满足的招生计划，会在两个数组中各出现一次（plans 会被分别过滤）
 * - 当未传入 minScore/maxScore（或参数无效）时，默认全部放入 inRange，notInRange 为空数组
 */
export class EnrollmentPlansByScoreRangeDto {
  @Expose()
  @Type(() => EnrollmentPlanWithScoresDto)
  inRange: EnrollmentPlanWithScoresDto[];

  @Expose()
  @Type(() => EnrollmentPlanWithScoresDto)
  notInRange: EnrollmentPlanWithScoresDto[];

  @Expose()
  provinces: string[];
}

