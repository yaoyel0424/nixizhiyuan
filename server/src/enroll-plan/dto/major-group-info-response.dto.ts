import { Expose, Type } from 'class-transformer';

/**
 * 专业热爱能量 DTO
 */
export class MajorLoveEnergyDto {
  @Expose()
  majorCode: string;

  @Expose()
  majorName: string;

  @Expose()
  loveEnergy: number | null;
}

/**
 * 专业组信息响应 DTO（单个招生计划）
 */
export class MajorGroupInfoResponseDto {
  @Expose()
  id: number;

  @Expose()
  studyPeriod: string | null;

  @Expose()
  enrollmentQuota: string | null;

  @Expose()
  remark: string | null;

  @Expose()
  enrollmentMajor: string | null;

  @Expose()
  @Type(() => MajorLoveEnergyDto)
  scores: MajorLoveEnergyDto[];
}

