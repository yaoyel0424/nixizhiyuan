import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ArrayOverlap } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { MajorScore } from '@/entities/major-score.entity';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Province } from '@/entities/province.entity';
import { ScoresService } from '@/scores/scores.service';
import { IdTransformUtil } from '@/common/utils/id-transform.util';
import {
  EnrollmentPlansByScoreRangeDto,
  EnrollmentPlanWithScoresDto,
  EnrollmentPlanItemDto,
  SchoolSimpleDto,
  SchoolDetailSimpleDto,
  MajorGroupSimpleDto,
  MajorScoreSimpleDto,
} from './dto/enrollment-plan-with-scores.dto';
import { MajorGroupInfoResponseDto, MajorLoveEnergyDto } from './dto/major-group-info-response.dto';
import { PROVINCE_NAME_TO_CODE } from '@/config/province';

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
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolDetail)
    private readonly schoolDetailRepository: Repository<SchoolDetail>,
    @InjectRepository(MajorScore)
    private readonly majorScoreRepository: Repository<MajorScore>,
    @InjectRepository(ProvinceFavorite)
    private readonly provinceFavoriteRepository: Repository<ProvinceFavorite>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
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
    minScore?: number,
    maxScore?: number,
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

    // 2. 查询用户收藏的省份，JOIN Province 获取省份名称
    const provinceFavorites = await this.provinceFavoriteRepository.find({
      where: { userId: userId },
      relations: ['province'],
    });

    // 获取收藏的省份名称列表
    const favoriteProvinceNames = provinceFavorites
      .map((pf) => pf.province?.name)
      .filter((name): name is string => !!name);

    // 验证用户是否收藏了省份
    if (favoriteProvinceNames.length === 0) {
      throw new BadRequestException('请先收藏您的意向省份');
    }

    // 使用收藏的省份名称列表
    const provinceNames = favoriteProvinceNames;

    // 3. 获取用户收藏的专业
    const majorFavorites = await this.majorFavoriteRepository.find({
      where: { userId },
      relations: ['major'],
    });

    if (majorFavorites.length === 0) {
      this.logger.log(`用户 ${userId} 没有收藏的专业`);
      return [];
    }

    // 4. 获取所有收藏专业的ID和代码（从已加载的 major 关系中获取）
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

    // 5. 计算热爱能量分值
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

    // 6. 构建查询条件
    const queryBuilder = this.enrollmentPlanRepository
      .createQueryBuilder('ep')
      .leftJoinAndSelect('ep.school', 'school')
      // 按照索引顺序添加查询条件：schoolCode, province, subjectSelectionMode, batch, enrollmentType, year
      // schoolCode 条件：学校的省份名称在用户收藏的省份中（通过 JOIN 的 school 表过滤）
      .where('school.province_name IN (:...provinceNames)', {
        provinceNames: provinceNames,
      })
      // province 条件：招生计划的省份在用户收藏的省份中（索引顺序：schoolCode → province）
      .andWhere('ep.province=:province', { province: user.province })
      .andWhere('ep.year = :year', { year })
      .andWhere('ep.enrollment_type = :enrollmentType', {
        enrollmentType: '普通类',
      });

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

    // 分数段筛选（可选）：满足对应分数段的院校
    // 使用 EXISTS 避免 JOIN 造成 enrollment_plans 结果重复
    if (
      minScore !== undefined &&
      maxScore !== undefined &&
      Number.isFinite(minScore) &&
      Number.isFinite(maxScore) &&
      minScore <= maxScore
    ) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM major_scores ms
          WHERE 
           "ep"."school_code" = "ms"."school_code"::varchar
            AND "ep"."province" = "ms"."province"::varchar
            AND "ep"."batch" = "ms"."batch"::varchar
            AND "ep"."subject_selection_mode" = "ms"."subject_selection_mode"::varchar
            AND "ep"."enrollment_major" = "ms"."enrollment_major"
            AND "ep"."enrollment_type" = "ms"."enrollment_type"
            AND "ep"."key_words" = "ms"."key_words"
            AND "ms"."min_score" IS NOT NULL
            AND "ms"."min_score" BETWEEN :minScore AND :maxScore
        )`,
        { minScore, maxScore },
      );
    }

    // 7. 执行查询
    const enrollmentPlans = await queryBuilder.getMany();

    if (enrollmentPlans.length === 0) {
      this.logger.log(
        `用户 ${userId} 没有找到匹配的招生计划，收藏省份: ${provinceNames.join(', ')}, 批次: ${user.enrollType}, 首选: ${user.preferredSubjects}`,
      );
      // 即使没有匹配的招生计划，也要返回所有收藏的专业，schoolCount 为 0
    }

    // 8. 按收藏专业分组招生计划
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

    // 9. 按 score 倒序排序（score 为 null 的排在最后）
    result.sort((a, b) => {
      // 如果 a.score 为 null，排在后面
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      // 按 score 倒序排列（分数高的在前）
      return b.score - a.score;
    });

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
   * @param minScore 最低分（可选，用于按分数段分组）
   * @param maxScore 最高分（可选，用于按分数段分组）
   * @returns 招生计划列表（包含学校、学校详情、专业组和分数信息）
   */
  async findEnrollmentPlansByMajorId(
    majorId: number,
    userId: number,
    year: string = '2025',
    minScore?: number,
    maxScore?: number,
  ): Promise<EnrollmentPlansByScoreRangeDto> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const rank = user?.rank ?? 0; 

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 查询用户收藏的省份，JOIN Province 获取省份名称
    const provinceFavorites = await this.provinceFavoriteRepository.find({
      where: { userId: userId },
      relations: ['province'],
    });

    // 获取收藏的省份名称列表
    const favoriteProvinceNames = provinceFavorites
      .map((pf) => pf.province?.name)
      .filter((name): name is string => !!name);

    // 如果用户没有收藏省份，从配置中加载所有省份名称
    let allProvinceNames: string[] = [];
    if (favoriteProvinceNames.length === 0) {
      allProvinceNames = Object.keys(PROVINCE_NAME_TO_CODE);
    }

    // 使用收藏的省份名称列表，如果没有收藏则使用所有省份
    const provinceNamesList = favoriteProvinceNames.length > 0 
      ? favoriteProvinceNames 
      : allProvinceNames;
 
    // 如果 user.province 不为空，将其排在第一个位置
    let provinceNames = [...provinceNamesList];
    if (user.province && user.province.trim()) {
      // 从列表中移除 user.province（如果存在）
      provinceNames = provinceNames.filter(name => name !== user.province);
      // 将 user.province 添加到第一个位置
      provinceNames.unshift(user.province);
    }
 
    // 4. 处理次选科目数组
    const secondarySubjectsArray = user.secondarySubjects
      ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
      : [];

    // 5. 构建查询（使用 getRawAndEntities 来获取 JOIN 的数据）
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
         AND "ep"."enrollment_major"="ms"."enrollment_major"
         AND  "ep"."enrollment_type"="ms"."enrollment_type"
         AND "ep"."key_words"="ms"."key_words" 
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
      // 按照索引顺序添加查询条件：schoolCode, province, subjectSelectionMode, batch, enrollmentType, year
      // schoolCode 条件：学校的省份名称在用户收藏的省份中（通过 JOIN 的 school 表过滤）
      .where('school.province_name IN (:...provinceNames)', {
        provinceNames: provinceNames,
      })
      // province 条件：招生计划的省份在用户收藏的省份中（索引顺序：schoolCode → province）
      .andWhere('ep.province = :province', { province: user.province });

    // 批次条件（从用户的 enrollType 获取）（索引顺序：province → batch）
    if (user.enrollType) {
      queryBuilder.andWhere('ep.batch = :batch', { batch: user.enrollType });
    }

    // 招生类型条件（索引顺序：province → batch → enrollmentType）
    queryBuilder.andWhere('ep.enrollment_type = :enrollmentType', {
      enrollmentType: '普通类',
    });

    // 年份条件（索引顺序：province → batch → enrollmentType → year，放在最后）
    queryBuilder.andWhere('ep.year = :year', { year });

    // 首选科目条件（不在索引中，但需要查询）
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

    // 5. 先按 school 分组，再按 enrollmentMajor 和 remark 分组
    // 完全基于 raw 数据构建结果，因为 entities 会被去重
    // 外层 Map: schoolCode -> school 信息和 plans
    // 内层 Map: enrollmentMajor|remark -> enrollmentPlan 信息
    const schoolMap = new Map<
      string,
      {
        school: School | null;
        enrollmentRate: number | null;
        employmentRate: number | null;
        plans: Map<
          string,
          EnrollmentPlan & {
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
              rankDiff: string;
            }>;
          }
        >;
      }
    >();

    // 使用 raw 数据来分组，因为 raw 数据包含所有 JOIN 的结果（75条）
    raw.forEach((rawData) => {
      // 从 raw 数据中获取 school_code
      const schoolCode = rawData['ep_school_code'];
      if (!schoolCode) {
        return;
      }

      // 从 raw 数据中获取 enrollment_major 和 remark，用于内部分组
      const enrollmentMajor = rawData['ep_enrollment_major'] ?? '';
      const remark = rawData['ep_remark'] ?? '';
      const planKey = `${enrollmentMajor}|${remark}`;

      // 如果该 school 还没有在 map 中，初始化
      if (!schoolMap.has(schoolCode)) {
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

        schoolMap.set(schoolCode, {
          school,
          enrollmentRate: rawData['schoolDetail_enrollment_rate'] ?? null,
          employmentRate: rawData['schoolDetail_employment_rate'] ?? null,
          plans: new Map(),
        });
      }

      const schoolData = schoolMap.get(schoolCode)!;

      // 如果该 plan 分组还没有在 map 中，从 raw 数据构建实体
      if (!schoolData.plans.has(planKey)) {
        // 从 raw 数据构建 enrollment_plan 实体
        const epId = rawData['ep_id'];
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

        schoolData.plans.set(planKey, {
          ...enrollmentPlan,
          majorGroup,
          majorScores: [],
        });
      }

      const enrollmentPlan = schoolData.plans.get(planKey)!;

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
          rankDiff: rawData['ms_min_rank'] - rank > 0 ? `比我低${rawData['ms_min_rank'] - rank}位` : rawData['ms_min_rank'] - rank < 0 ? `比我高${Math.abs(rawData['ms_min_rank'] - rank)}位` : '与我相同',
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
    const simplifiedResults: EnrollmentPlanWithScoresDto[] = Array.from(
      schoolMap.values(),
    ).map((schoolData) => {
      // 简化的 school（包含 enrollmentRate 和 employmentRate）
      const schoolSimple: SchoolSimpleDto = schoolData.school
        ? {
            code: schoolData.school.code,
            name: schoolData.school.name,
            nature: schoolData.school.nature,
            level: schoolData.school.level,
            belong: schoolData.school.belong,
            categories: schoolData.school.categories,
            features: schoolData.school.features,
            provinceName: schoolData.school.provinceName,
            cityName: schoolData.school.cityName,
            enrollmentRate: schoolData.enrollmentRate,
            employmentRate: schoolData.employmentRate,
          }
        : {
            code: '',
            name: '',
            nature: '',
            level: '',
            belong: '',
            categories: '',
            features: '',
            provinceName: '',
            cityName: '',
            enrollmentRate: schoolData.enrollmentRate,
            employmentRate: schoolData.employmentRate,
          };

      // 转换为 plans 数组
      const plans = Array.from(schoolData.plans.values()).map((ep) => {
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
            rankDiff: ms.rankDiff,
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
          majorGroup: majorGroupSimple,
          majorScores: majorScoresSimple,
        };
      });

      return {
        school: schoolSimple,
        plans,
      };
    });

    // 分数段分组：返回两个数组（满足分数段 / 不满足分数段）
    // 同一学校如果同时存在满足与不满足的招生计划，会在两个数组中各出现一次（plans 会被分别过滤）
    const hasScoreRangeGroup =
      minScore !== undefined &&
      maxScore !== undefined &&
      Number.isFinite(minScore) &&
      Number.isFinite(maxScore) &&
      minScore <= maxScore;

    const isPlanInRange = (
      plan: EnrollmentPlanItemDto,
      min: number,
      max: number,
    ): boolean => {
      const scores = Array.isArray((plan as any).majorScores)
        ? ((plan as any).majorScores as any[])
        : [];
      return scores.some((s) => {
        const rawMinScore = s?.minScore;
        const scoreNum =
          typeof rawMinScore === 'number'
            ? rawMinScore
            : rawMinScore !== null && rawMinScore !== undefined
              ? Number.parseFloat(String(rawMinScore))
              : NaN;
        if (!Number.isFinite(scoreNum)) return false;
        return scoreNum >= min && scoreNum <= max;
      });
    };

    const groupedResult = hasScoreRangeGroup
      ? (() => {
          const inRange: EnrollmentPlanWithScoresDto[] = [];
          const notInRange: EnrollmentPlanWithScoresDto[] = [];

          simplifiedResults.forEach((school) => {
            const inRangePlans = (school.plans || []).filter((p) =>
              isPlanInRange(p as any, minScore as number, maxScore as number),
            );
            const notInRangePlans = (school.plans || []).filter(
              (p) => !isPlanInRange(p as any, minScore as number, maxScore as number),
            );

            if (inRangePlans.length > 0) {
              inRange.push({
                school: school.school,
                plans: inRangePlans,
              } as any);
            }
            if (notInRangePlans.length > 0) {
              notInRange.push({
                school: school.school,
                plans: notInRangePlans,
              } as any);
            }
          });

          return { inRange, notInRange };
        })()
      : { inRange: simplifiedResults, notInRange: [] };

    const totalPlans = simplifiedResults.reduce(
      (sum, school) => sum + school.plans.length,
      0,
    );
    this.logger.log(
      `用户 ${userId} 查询专业ID ${majorId} 的招生计划，找到 ${simplifiedResults.length} 所学校，共 ${totalPlans} 个招生计划（原始 raw 数据 ${raw.length} 条）`,
    );

    // 使用 plainToInstance 转换，使 @Transform 装饰器生效
    const result = plainToInstance(EnrollmentPlansByScoreRangeDto, groupedResult, {
      excludeExtraneousValues: true,
    });

    // 添加 provinces 数组
    (result as any).provinces = provinceNames;

    return result;
  }

  /**
   * 通过专业组ID查询专业组信息
   * @param encodedMgId 混淆后的专业组ID
   * @param userId 用户ID（用于计算热爱能量）
   * @returns 专业组信息及专业热爱能量数组
   */
  async getMajorGroupInfoByMgId(
    encodedMgId: number,
    userId: number,
  ): Promise<MajorGroupInfoResponseDto[]> {
    // 1. 反转换 mg_id
    const realMgId = IdTransformUtil.decode(encodedMgId);

    if (realMgId === null) {
      throw new NotFoundException('无效的专业组ID');
    }

    // 2. 查询 enrollment_plans，通过 majorGroupId 查询（可能有多个）
    const enrollmentPlans = await this.enrollmentPlanRepository.find({
      where: { majorGroupId: realMgId },
    });

    if (!enrollmentPlans || enrollmentPlans.length === 0) {
      throw new NotFoundException('未找到对应的招生计划');
    }

    // 3. 合并所有 enrollmentPlan 的 level3MajorId 数组（去重），用于一次性查询所有 major
    const allLevel3MajorIds = new Set<number>();
    enrollmentPlans.forEach((ep) => {
      if (ep.level3MajorId && ep.level3MajorId.length > 0) {
        ep.level3MajorId.forEach((id) => allLevel3MajorIds.add(id));
      }
    });

    const level3MajorIds = Array.from(allLevel3MajorIds);

    // 4. 一次性查询所有需要的 major 信息
    let majorsMap = new Map<number, Major>();
    let loveEnergyMap = new Map<string, number>();

    if (level3MajorIds.length > 0) {
      const majors = await this.majorRepository.find({
        where: { id: In(level3MajorIds) },
      });

      // 创建 major id 到 major 实体的映射
      majors.forEach((major) => {
        majorsMap.set(major.id, major);
      });

      // 5. 获取所有专业代码，一次性计算所有专业的热爱能量
      const majorCodes = majors.map((major) => major.code).filter((code) => code);

      if (majorCodes.length > 0) {
        try {
          const scores = await this.scoresService.calculateScores(
            userId,
            undefined, // 不限制教育层次
            majorCodes,
          );

          // 创建专业代码到热爱能量的映射
          scores.forEach((scoreInfo) => {
            loveEnergyMap.set(scoreInfo.majorCode, scoreInfo.score);
          });
        } catch (error) {
          this.logger.warn(
            `计算专业热爱能量失败，用户ID: ${userId}, 错误: ${error instanceof Error ? error.message : String(error)}`,
          );
          // 计算失败不影响返回结果，只是没有热爱能量信息
        }
      }
    }

    // 6. 为每个 enrollmentPlan 构建对应的 scores
    const results: MajorGroupInfoResponseDto[] = enrollmentPlans.map((ep) => {
      // 获取当前 enrollmentPlan 的 level3MajorId
      const currentLevel3MajorIds = ep.level3MajorId || [];

      // 为当前 enrollmentPlan 构建对应的 scores
      const scores: MajorLoveEnergyDto[] = currentLevel3MajorIds
        .map((majorId) => {
          const major = majorsMap.get(majorId);
          if (!major) {
            return null;
          }
          return {
            majorCode: major.code,
            majorName: major.name,
            loveEnergy: loveEnergyMap.get(major.code) || null,
          };
        })
        .filter((item): item is MajorLoveEnergyDto => item !== null);

      return {
        id: ep.id,
        studyPeriod: ep.studyPeriod,
        enrollmentQuota: ep.enrollmentQuota,
        remark: ep.remark,
        enrollmentMajor: ep.enrollmentMajor,
        scores,
      };
    });

    this.logger.log(
      `通过专业组ID ${realMgId}（混淆ID: ${encodedMgId}）查询专业组信息，找到 ${enrollmentPlans.length} 个招生计划`,
    );

    return plainToInstance(MajorGroupInfoResponseDto, results, {
      excludeExtraneousValues: true,
    });
  }
}

