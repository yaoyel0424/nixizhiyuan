import { Expose, Type, Transform, Exclude } from 'class-transformer';
import { IdTransformUtil } from '@/common/utils/id-transform.util';
import { SchoolSimpleDto } from '@/enroll-plan/dto/enrollment-plan-with-scores.dto';

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
 * 志愿选择项 DTO（与 EnrollmentPlanItemDto 结构一致，但加上 userId）
 */
export class ChoiceResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  schoolCode: string;

  @Expose()
  @Transform(({ value }) => IdTransformUtil.encode(value))
  majorGroupId: number | null;

  @Expose()
  mgIndex: number | null;

  @Expose()
  majorIndex: number | null;

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

  @Expose()
  @Type(() => SchoolSimpleDto)
  school: SchoolSimpleDto | null;
}
