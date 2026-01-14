import { Expose, Type, Transform } from 'class-transformer';
import { ChoiceResponseDto, MajorScoreSimpleDto } from './choice-response.dto';
import { SchoolSimpleDto } from '@/enroll-plan/dto/enrollment-plan-with-scores.dto';
import { MajorGroupSimpleDto } from './choice-response.dto';
import { IdTransformUtil } from '@/common/utils/id-transform.util';

/**
 * 分组结构中的志愿选择 DTO（不包含 school 和 majorGroup 信息）
 */
export class ChoiceInGroupDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  schoolCode: string;

  @Expose()
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return null;
    }
    return IdTransformUtil.encode(value);
  }, { toPlainOnly: true })
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
  @Type(() => MajorScoreSimpleDto)
  majorScores: MajorScoreSimpleDto[];
}

/**
 * 专业组分组 DTO（包含专业组信息和该专业组下的志愿列表）
 */
export class MajorGroupGroupDto {
  @Expose()
  @Type(() => MajorGroupSimpleDto)
  majorGroup: MajorGroupSimpleDto;

  @Expose()
  @Type(() => ChoiceInGroupDto)
  choices: ChoiceInGroupDto[];
}

/**
 * 学校分组 DTO（包含学校信息和该学校下的专业组列表）
 */
export class SchoolGroupDto {
  @Expose()
  mgIndex: number | null; // mgIndex 与 school 同一层

  @Expose()
  @Type(() => SchoolSimpleDto)
  school: SchoolSimpleDto;

  @Expose()
  @Type(() => MajorGroupGroupDto)
  majorGroups: MajorGroupGroupDto[];
}

/**
 * 志愿统计信息 DTO
 */
export class VolunteerStatisticsDto {
  @Expose()
  selected: number; // 已选择的志愿数量（mgIndex 的唯一数量）

  @Expose()
  total: number; // 该省份允许的最大志愿数量
}

/**
 * 分组后的志愿选择响应 DTO（包含数据和统计信息）
 */
export class GroupedChoiceResponseDto {
  @Expose()
  @Type(() => SchoolGroupDto)
  volunteers: SchoolGroupDto[];

  @Expose()
  @Type(() => VolunteerStatisticsDto)
  statistics: VolunteerStatisticsDto;
}
