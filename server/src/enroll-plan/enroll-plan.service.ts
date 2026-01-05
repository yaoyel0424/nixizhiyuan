import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ArrayOverlap } from 'typeorm';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { MajorScore } from '@/entities/major-score.entity';
import { ScoresService } from '@/scores/scores.service';
import {
  EnrollmentPlanWithScoresDto,
  SchoolSimpleDto,
  SchoolDetailSimpleDto,
  MajorGroupSimpleDto,
  MajorScoreSimpleDto,
} from './dto/enrollment-plan-with-scores.dto';

/**
 * 招生计划服务
 * 处理招生计划相关的业务逻辑
 */
@Injectable()
export class EnrollPlanService {
  private readonly logger = new Logger(EnrollPlanService.name);

  constructor(
    @InjectRepository(EnrollmentPlan)
    private readonly enrollmentPlanRepository: Repository<EnrollmentPlan>,
    @InjectRepository(MajorFavorite)
    private readonly majorFavoriteRepository: Repository<MajorFavorite>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolDetail)
    private readonly schoolDetailRepository: Repository<SchoolDetail>,
    @InjectRepository(MajorScore)
    private readonly majorScoreRepository: Repository<MajorScore>,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * 根据用户信息查询匹配的招生计划
   * @param userId 用户ID
   * @param year 年份，默认为2025
   * @returns 按收藏专业分组的招生计划，每个专业包含学校数组
   */
  async findEnrollmentPlansByUser(
    userId: number,
    year: string = '2025',
  ): Promise<
    Array<{
      majorFavorite: {
        id: number;
        majorCode: string;
        major: {
          id: number;
          name: string;
          code: string;
          eduLevel: string;
        };
      };
      score: number | null;
      schools: Array<{
        code: string;
        name: string | null;
      }>;
      schoolCount: number;
    }>
  > {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 获取用户收藏的专业（按收藏顺序排序，先收藏的在前）
    const majorFavorites = await this.majorFavoriteRepository.find({
      where: { userId },
      relations: ['major'],
      order: { createdAt: 'ASC' }, // 按收藏时间升序，先收藏的在前
    });

    if (majorFavorites.length === 0) {
      this.logger.log(`用户 ${userId} 没有收藏的专业`);
      return [];
    }

    // 3. 获取所有收藏专业的ID和代码（从已加载的 major 关系中获取）
    const majorIds = majorFavorites
      .map((mf) => mf.major?.id)
      .filter((id): id is number => id !== undefined && id !== null);

    if (majorIds.length === 0) {
      this.logger.log(`用户 ${userId} 收藏的专业中没有找到有效的专业ID`);
      return [];
    }

    const majorCodes = majorFavorites
      .map((mf) => mf.majorCode)
      .filter((code) => code);

    // 4. 计算热爱能量分值
    let scoresMap = new Map<string, number>();
    if (majorCodes.length > 0) {
      try {
        const scores = await this.scoresService.calculateScores(
          userId,
          undefined, // 不限制教育层次
          majorCodes,
        );
        scores.forEach((scoreInfo) => {
          scoresMap.set(scoreInfo.majorCode, scoreInfo.score);
        });
      } catch (error) {
        this.logger.warn(
          `计算专业分数失败，用户ID: ${userId}, 错误: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 分数计算失败不影响返回结果，只是没有分数信息
      }
    }

    // 5. 构建查询条件
    const queryBuilder = this.enrollmentPlanRepository
      .createQueryBuilder('ep')
      .leftJoinAndSelect('ep.school', 'school')
      .where('ep.year = :year', { year })
      .andWhere('ep.enrollment_type = :enrollmentType', {
        enrollmentType: '普通类',
      });

    // 省份条件
    if (user.province) {
      queryBuilder.andWhere('ep.province = :province', {
        province: user.province,
      });
    }

    // 批次条件（从用户的 enrollType 获取）
    if (user.enrollType) {
      queryBuilder.andWhere('ep.batch = :batch', { batch: user.enrollType });
    }

    // 首选科目条件
    if (user.preferredSubjects) {
      queryBuilder.andWhere('ep.primary_subject = :primarySubject', {
        primarySubject: user.preferredSubjects,
      });
    }

    // 次选科目条件（支持不限、任选、必选）
    if (user.secondarySubjects) {
      const secondarySubjectsArray = user.secondarySubjects
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s);

      if (secondarySubjectsArray.length > 0) {
        queryBuilder.andWhere(
          `(
            ep.secondary_subject_type IS NULL
            OR ep.secondary_subjects IS NULL
            OR ep.secondary_subjects = ARRAY[]::varchar[]
            OR (ep.secondary_subject_type = false AND ep.secondary_subjects && ARRAY[:...secondarySubjects]::varchar[])
            OR (
              ep.secondary_subject_type = true 
              AND ep.secondary_subjects <@ ARRAY[:...secondarySubjects]::varchar[]
              AND array_length(ep.secondary_subjects, 1) > 0
            )
          )`,
          { secondarySubjects: secondarySubjectsArray },
        );
      }
    } else {
      // 如果没有次选科目，只查询次选不限的记录
      queryBuilder.andWhere(
        `(
          ep.secondary_subject_type IS NULL
          OR ep.secondary_subjects IS NULL
          OR ep.secondary_subjects = ARRAY[]::varchar[]
        )`,
      );
    }

    // level3_major_id 包含匹配的专业ID
    queryBuilder.andWhere('ep.level3_major_id && ARRAY[:...majorIds]::integer[]', {
      majorIds,
    });

    // 6. 执行查询
    const enrollmentPlans = await queryBuilder.getMany();

    if (enrollmentPlans.length === 0) {
      this.logger.log(
        `用户 ${userId} 没有找到匹配的招生计划，省份: ${user.province}, 批次: ${user.enrollType}, 首选: ${user.preferredSubjects}`,
      );
      return [];
    }

    // 7. 按收藏专业分组招生计划
    const result: Array<{
      majorFavorite: {
        id: number;
        majorCode: string;
        major: {
          id: number;
          name: string;
          code: string;
          eduLevel: string;
        };
      };
      score: number | null;
      schools: Array<{
        code: string;
        name: string | null;
      }>;
      schoolCount: number;
    }> = [];

    // 遍历每个收藏的专业
    for (const majorFavorite of majorFavorites) {
      const major = majorFavorite.major;
      if (!major) {
        continue;
      }

      // 找到该专业匹配的招生计划
      const majorEnrollmentPlans = enrollmentPlans.filter((ep) => {
        return (
          ep.level3MajorId &&
          Array.isArray(ep.level3MajorId) &&
          ep.level3MajorId.includes(major.id)
        );
      });

      const score = scoresMap.get(majorFavorite.majorCode) || null;

      if (majorEnrollmentPlans.length === 0) {
        // 如果没有匹配的招生计划，仍然添加到结果中，但 schools 为空
        result.push({
          majorFavorite: {
            id: majorFavorite.id,
            majorCode: majorFavorite.majorCode,
            major: {
              id: major.id,
              name: major.name,
              code: major.code,
              eduLevel: major.eduLevel,
            },
          },
          score,
          schools: [],
          schoolCount: 0,
        });
        continue;
      }

      // 按学校分组招生计划
      const schoolMap = new Map<
        string,
        {
          school: School | null;
          enrollmentPlans: EnrollmentPlan[];
        }
      >();

      majorEnrollmentPlans.forEach((ep) => {
        if (!ep.schoolCode) {
          return;
        }

        if (!schoolMap.has(ep.schoolCode)) {
          schoolMap.set(ep.schoolCode, {
            school: ep.school || null,
            enrollmentPlans: [],
          });
        }

        schoolMap.get(ep.schoolCode)!.enrollmentPlans.push(ep);
      });

      // 转换为学校数组（只返回 code 和 name）
      const schools = Array.from(schoolMap.values())
        .filter((item) => item.school !== null)
        .map((item) => ({
          code: item.school!.code,
          name: item.school!.name,
        }))
        .filter((school, index, self) => {
          // 去重：按 code 去重
          return self.findIndex((s) => s.code === school.code) === index;
        });

      result.push({
        majorFavorite: {
          id: majorFavorite.id,
          majorCode: majorFavorite.majorCode,
          major: {
            id: major.id,
            name: major.name,
            code: major.code,
            eduLevel: major.eduLevel,
          },
        },
        score,
        schools,
        schoolCount: schools.length,
      });
    }

    this.logger.log(
      `用户 ${userId} 找到 ${result.length} 个收藏专业，共 ${enrollmentPlans.length} 个匹配的招生计划`,
    );

    return result;
  }

  /**
   * 根据专业ID查询招生计划和分数信息
   * @param majorId 专业ID
   * @param userId 用户ID（用于获取用户信息）
   * @param year 年份，默认为2025
   * @returns 招生计划列表（包含学校、学校详情、专业组和分数信息）
   */
  async findEnrollmentPlansByMajorId(
    majorId: number,
    userId: number,
    year: string = '2025',
  ): Promise<EnrollmentPlanWithScoresDto[]> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 处理次选科目数组
    const secondarySubjectsArray = user.secondarySubjects
      ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
      : [];

    // 3. 构建查询（使用 getRawAndEntities 来获取 JOIN 的数据）
    const queryBuilder = this.enrollmentPlanRepository
      .createQueryBuilder('ep')
      // 加载 school 关系
      .leftJoinAndSelect('ep.school', 'school')
      // 加载 schoolDetail（通过 school.code 关联）
      .leftJoinAndSelect(
        'school_details',
        'schoolDetail',
        'schoolDetail.code = school.code',
      )
      // 加载 majorGroup 关系
      .leftJoinAndSelect('ep.majorGroup', 'majorGroup')
      // 加载 major_scores（复杂 JOIN 条件）
      .leftJoin(
        'major_scores',
        'ms',
        `"ep"."school_code" = "ms"."school_code"::varchar
         AND "ep"."province" = "ms"."province"::varchar
         AND "ep"."batch" = "ms"."batch"::varchar
         AND "ep"."subject_selection_mode" = "ms"."subject_selection_mode"::varchar
         AND (
           ("ep"."level3_major_id" && ARRAY[:majorId]::integer[] 
            AND "ms"."level3_major_id" && ARRAY[:majorId]::integer[])
           OR
           ("ep"."level2_major_ids" && "ms"."level2_major_ids" 
            AND array_length("ep"."level2_major_ids", 1) > 0 
            AND array_length("ms"."level2_major_ids", 1) > 0
            AND (
              "ep"."sub_level2_major_ids" = "ms"."sub_level2_major_ids"
              OR
              ("ep"."sub_level2_major_ids" && "ms"."sub_level2_major_ids" 
               AND array_length("ep"."sub_level2_major_ids", 1) > 0 
               AND array_length("ms"."sub_level2_major_ids", 1) > 0)
            ))
         )`,
        { majorId },
      )
      // 只选择最终 DTO 需要的字段（减少数据传输量）
      .addSelect('"ms"."id"', 'ms_id') // 用于去重
      .addSelect('"ms"."school_code"', 'ms_school_code')
      .addSelect('"ms"."province"', 'ms_province')
      .addSelect('"ms"."year"', 'ms_year')
      .addSelect('"ms"."subject_selection_mode"', 'ms_subject_selection_mode')
      .addSelect('"ms"."batch"', 'ms_batch')
      .addSelect('"ms"."min_score"', 'ms_min_score')
      .addSelect('"ms"."min_rank"', 'ms_min_rank')
      .addSelect('"ms"."admit_count"', 'ms_admit_count')
      .addSelect('"ms"."enrollment_type"', 'ms_enrollment_type')
      .where('ep.year = :year', { year })
      .andWhere('ep.enrollment_type = :enrollmentType', {
        enrollmentType: '普通类',
      });

    // 省份条件
    if (user.province) {
      queryBuilder.andWhere('ep.province = :province', {
        province: user.province,
      });
    }

    // 批次条件（从用户的 enrollType 获取）
    if (user.enrollType) {
      queryBuilder.andWhere('ep.batch = :batch', { batch: user.enrollType });
    }

    // 首选科目条件
    if (user.preferredSubjects) {
      queryBuilder.andWhere('ep.primary_subject = :primarySubject', {
        primarySubject: user.preferredSubjects,
      });
    }

    // level3_major_id 包含匹配的专业ID
    queryBuilder.andWhere('ep.level3_major_id && ARRAY[:majorId]::integer[]', {
      majorId,
    });

    // 次选科目条件
    if (secondarySubjectsArray.length > 0) {
      queryBuilder.andWhere(
        `(
          ep.secondary_subject_type IS NULL
          OR ep.secondary_subjects IS NULL
          OR ep.secondary_subjects = ARRAY[]::varchar[]
          OR (ep.secondary_subject_type = false AND ep.secondary_subjects && ARRAY[:...secondarySubjects]::varchar[])
          OR (
            ep.secondary_subject_type = true 
            AND ep.secondary_subjects <@ ARRAY[:...secondarySubjects]::varchar[]
            AND array_length(ep.secondary_subjects, 1) > 0
          )
        )`,
        { secondarySubjects: secondarySubjectsArray },
      );
    } else {
      // 如果没有次选科目，只查询次选不限的记录
      queryBuilder.andWhere(
        `(
          ep.secondary_subject_type IS NULL
          OR ep.secondary_subjects IS NULL
          OR ep.secondary_subjects = ARRAY[]::varchar[]
        )`,
      );
    }

    // 4. 执行查询并获取原始数据（使用 getRaw() 获取所有记录，不被去重）
    const raw = await queryBuilder.getRawMany();

    // 5. 按 enrollment_plan 分组，将多个 major_scores 合并为数组
    // 完全基于 raw 数据构建结果，因为 entities 会被去重
    const enrollmentPlanMap = new Map<
      number,
      EnrollmentPlan & {
        school: School | null;
        schoolDetail: SchoolDetail | null;
        majorGroup: any | null;
        majorScores: Array<{
          id: number;
          schoolCode: string | null;
          province: string | null;
          year: string | null;
          subjectSelectionMode: string | null;
          batch: string | null;
          minScore: number | null;
          minRank: number | null;
          admitCount: number | null;
          enrollmentType: string | null;
        }>;
      }
    >();

    // 使用 raw 数据来分组，因为 raw 数据包含所有 JOIN 的结果（75条）
    raw.forEach((rawData) => {
      // 从 raw 数据中获取 enrollment_plan 的 id
      const epId = rawData['ep_id'];

      if (!epId) {
        return;
      }

      // 如果该 enrollment_plan 还没有在 map 中，从 raw 数据构建实体
      if (!enrollmentPlanMap.has(epId)) {
        // 从 raw 数据构建 enrollment_plan 实体
        const enrollmentPlan: EnrollmentPlan = {
          id: epId,
          schoolCode: rawData['ep_school_code'],
          majorGroupId: rawData['ep_major_group_id'] ?? null,
          majorGroupInfo: rawData['ep_major_group_info'] ?? null,
          province: rawData['ep_province'] ?? null,
          year: rawData['ep_year'] ?? null,
          batch: rawData['ep_batch'] ?? null,
          subjectSelectionMode: rawData['ep_subject_selection_mode'] ?? null,
          primarySubject: rawData['ep_primary_subject'] ?? null,
          secondarySubjects: rawData['ep_secondary_subjects'] ?? null,
          secondarySubjectType: rawData['ep_secondary_subject_type'] ?? null,
          studyPeriod: rawData['ep_study_period'] ?? null,
          enrollmentQuota: rawData['ep_enrollment_quota'] ?? null,
          enrollmentType: rawData['ep_enrollment_type'] ?? null,
          remark: rawData['ep_remark'] ?? null,
          tuitionFee: rawData['ep_tuition_fee'] ?? null,
          enrollmentMajor: rawData['ep_enrollment_major'] ?? null,
          curUnit: rawData['ep_cur_unit'] ?? null,
          level3MajorId: rawData['ep_level3_major_id'] ?? null,
          level2MajorIds: rawData['ep_level2_major_ids'] ?? null,
          subLevel2MajorIds: rawData['ep_sub_level2_major_ids'] ?? null,
        } as EnrollmentPlan;

        // 构建 school 实体
        const school: School | null = rawData['school_id']
          ? ({
              id: rawData['school_id'],
              code: rawData['school_code'],
              name: rawData['school_name'],
              nature: rawData['school_nature'],
              level: rawData['school_level'],
              belong: rawData['school_belong'],
              categories: rawData['school_categories'],
              features: rawData['school_features'],
              provinceName: rawData['school_province_name'],
              cityName: rawData['school_city_name'],
              admissionsEmail: rawData['school_admissions_email'],
              address: rawData['school_address'],
              postcode: rawData['school_postcode'],
              admissionsSite: rawData['school_admissions_site'],
              officialSite: rawData['school_official_site'],
              admissionsPhone: rawData['school_admissions_phone'],
              rankingOfRK: rawData['school_ranking_of_rk'],
              rankingOfXYH: rawData['school_ranking_of_xyh'],
            } as School)
          : null;

        // 构建 schoolDetail 实体
        const schoolDetail: SchoolDetail | null = rawData['schoolDetail_id']
          ? ({
              id: rawData['schoolDetail_id'],
              code: rawData['schoolDetail_code'],
              briefComment: rawData['schoolDetail_brief_comment'],
              keyTags: rawData['schoolDetail_key_tags'],
              historyIntro: rawData['schoolDetail_history_intro'],
              advantageMajors: rawData['schoolDetail_advantage_majors'],
              nationalLabs: rawData['schoolDetail_national_labs'],
              provincialLabs: rawData['schoolDetail_provincial_labs'],
              seniorRecommendations: rawData['schoolDetail_senior_recommendations'],
              disadvantages: rawData['schoolDetail_disadvantages'],
              dataSource: rawData['schoolDetail_data_source'],
              enrollmentRate: rawData['schoolDetail_enrollment_rate'],
              employmentRate: rawData['schoolDetail_employment_rate'],
            } as SchoolDetail)
          : null;

        // 构建 majorGroup 实体
        const majorGroup: any | null = rawData['majorGroup_id']
          ? {
              id: rawData['majorGroup_id'],
              schoolCode: rawData['majorGroup_school_code'],
              province: rawData['majorGroup_province'],
              year: rawData['majorGroup_year'],
              subjectSelectionMode: rawData['majorGroup_subject_selection_mode'],
              batch: rawData['majorGroup_batch'],
              mgId: rawData['majorGroup_mg_id'],
              mgName: rawData['majorGroup_mg_name'],
              mgInfo: rawData['majorGroup_mg_info'],
              primarySubject: rawData['majorGroup_primary_subject'],
              secondarySubjects: rawData['majorGroup_secondary_subjects'],
              secondarySubjectType: rawData['majorGroup_secondary_subject_type'],
            }
          : null;

        enrollmentPlanMap.set(epId, {
          ...enrollmentPlan,
          school,
          schoolDetail,
          majorGroup,
          majorScores: [],
        });
      }

      const enrollmentPlan = enrollmentPlanMap.get(epId)!;

      // 如果存在 major_scores 数据，创建 MajorScore 对象并添加到数组
      const msId = rawData['ms_id'];

      if (msId !== null && msId !== undefined) {
        // 只构建最终 DTO 需要的字段
        const majorScore = {
          id: msId,
          schoolCode: rawData['ms_school_code'] ?? null,
          province: rawData['ms_province'] ?? null,
          year: rawData['ms_year'] ?? null,
          subjectSelectionMode: rawData['ms_subject_selection_mode'] ?? null,
          batch: rawData['ms_batch'] ?? null,
          minScore: rawData['ms_min_score'] ?? null,
          minRank: rawData['ms_min_rank'] ?? null,
          admitCount: rawData['ms_admit_count'] ?? null,
          enrollmentType: rawData['ms_enrollment_type'] ?? null,
        };

        // 检查是否已存在相同的 majorScore（通过 id 判断，避免重复）
        const exists = enrollmentPlan.majorScores.some(
          (ms) => ms.id === majorScore.id,
        );
        if (!exists) {
          enrollmentPlan.majorScores.push(majorScore as any);
        }
      }
    });

    // 6. 转换为数组并简化为 DTO
    const processedResults = Array.from(enrollmentPlanMap.values());

    // 7. 转换为简化的 DTO 格式
    const simplifiedResults: EnrollmentPlanWithScoresDto[] =
      processedResults.map((ep) => {
        // 简化的 school
        const schoolSimple: SchoolSimpleDto | null = ep.school
          ? {
              code: ep.school.code,
              name: ep.school.name,
              nature: ep.school.nature,
              level: ep.school.level,
              belong: ep.school.belong,
              categories: ep.school.categories,
              features: ep.school.features,
              provinceName: ep.school.provinceName,
              cityName: ep.school.cityName,
            }
          : null;

        // 简化的 schoolDetail
        const schoolDetailSimple: SchoolDetailSimpleDto | null = ep.schoolDetail
          ? {
              code: ep.schoolDetail.code,
              enrollmentRate: ep.schoolDetail.enrollmentRate,
              employmentRate: ep.schoolDetail.employmentRate,
            }
          : null;

        // 简化的 majorGroup
        const majorGroupSimple: MajorGroupSimpleDto | null = ep.majorGroup
          ? {
              schoolCode: ep.majorGroup.schoolCode,
              province: ep.majorGroup.province,
              year: ep.majorGroup.year,
              subjectSelectionMode: ep.majorGroup.subjectSelectionMode,
              batch: ep.majorGroup.batch,
              mgId: ep.majorGroup.mgId,
              mgName: ep.majorGroup.mgName,
              mgInfo: ep.majorGroup.mgInfo,
            }
          : null;

        // 简化的 majorScores
        const majorScoresSimple: MajorScoreSimpleDto[] = ep.majorScores.map(
          (ms) => ({
            schoolCode: ms.schoolCode,
            province: ms.province,
            year: ms.year,
            subjectSelectionMode: ms.subjectSelectionMode,
            batch: ms.batch,
            minScore: ms.minScore,
            minRank: ms.minRank,
            admitCount: ms.admitCount,
            enrollmentType: ms.enrollmentType,
          }),
        );

        return {
          id: ep.id,
          schoolCode: ep.schoolCode,
          majorGroupId: ep.majorGroupId,
          majorGroupInfo: ep.majorGroupInfo,
          province: ep.province,
          year: ep.year,
          batch: ep.batch,
          subjectSelectionMode: ep.subjectSelectionMode,
          studyPeriod: ep.studyPeriod,
          enrollmentQuota: ep.enrollmentQuota,
          enrollmentType: ep.enrollmentType,
          remark: ep.remark,
          tuitionFee: ep.tuitionFee,
          enrollmentMajor: ep.enrollmentMajor,
          curUnit: ep.curUnit,
          school: schoolSimple,
          schoolDetail: schoolDetailSimple,
          majorGroup: majorGroupSimple,
          majorScores: majorScoresSimple,
        };
      });

    this.logger.log(
      `用户 ${userId} 查询专业ID ${majorId} 的招生计划，找到 ${simplifiedResults.length} 条记录（原始 raw 数据 ${raw.length} 条，合并后 ${simplifiedResults.length} 条）`,
    );

    return simplifiedResults;
  }
}

