import { Expose, Type } from 'class-transformer';

/**
 * 专业信息响应 DTO（关联的 Major 实体）
 */
export class MajorInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  level: number;
}

/**
 * 专业详情信息响应 DTO（关联的 MajorDetail 实体）
 */
export class MajorDetailInfoDto {
  @Expose()
  id: number;

  @Expose()
  code: string;

  @Expose()
  educationLevel: string | null;

  @Expose()
  studyPeriod: string | null;

  @Expose()
  awardedDegree: string | null;

  @Expose()
  majorBrief: string | null;

  @Expose()
  @Type(() => MajorInfoDto)
  major?: MajorInfoDto;
}

/**
 * 热门专业响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class PopularMajorResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  level1: string;

  @Expose()
  code: string;

  @Expose()
  degree: string | null;

  @Expose()
  limitYear: string | null;

  @Expose()
  averageSalary: string | null;

  @Expose()
  fiveAverageSalary: number;

  @Expose()
  @Type(() => MajorDetailInfoDto)
  majorDetail?: MajorDetailInfoDto;
}

