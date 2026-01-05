import { Expose, Type } from 'class-transformer';

/**
 * 简化的学校信息 DTO
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

  @Expose()
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
}

/**
 * 招生计划及分数信息 DTO
 */
export class EnrollmentPlanWithScoresDto {
  @Expose()
  id: number;

  @Expose()
  schoolCode: string;

  @Expose()
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
  @Type(() => SchoolSimpleDto)
  school: SchoolSimpleDto | null;

  @Expose()
  @Type(() => SchoolDetailSimpleDto)
  schoolDetail: SchoolDetailSimpleDto | null;

  @Expose()
  @Type(() => MajorGroupSimpleDto)
  majorGroup: MajorGroupSimpleDto | null;

  @Expose()
  @Type(() => MajorScoreSimpleDto)
  majorScores: MajorScoreSimpleDto[];
}

