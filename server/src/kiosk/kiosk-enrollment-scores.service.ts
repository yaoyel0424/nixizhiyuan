import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { Province } from '@/entities/province.entity';
import { ProvinceBatch } from '@/entities/province_batch.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import {
  EnrollmentPlansByScoreRangeDto,
  EnrollmentPlanWithScoresDto,
  EnrollmentPlanItemDto,
  SchoolSimpleDto,
  MajorGroupSimpleDto,
  MajorScoreSimpleDto,
} from '@/enroll-plan/dto/enrollment-plan-with-scores.dto';

/**
 * 自助终端：按专业 ID 查招生计划与分数（逻辑与 EnrollPlanService.findEnrollmentPlansByMajorId 查询体一致，独立于 enroll-plan.service）
 */
@Injectable()
export class KioskEnrollmentScoresService {
  private readonly logger = new Logger(KioskEnrollmentScoresService.name);

  constructor(
    @InjectRepository(EnrollmentPlan)
    private readonly enrollmentPlanRepository: Repository<EnrollmentPlan>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(ProvinceBatch)
    private readonly provinceBatchRepository: Repository<ProvinceBatch>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 根据教育层次与省份、年份从 province_batches 解析批次名称，用作招生计划筛选的 enrollType
   * ben、gaoben → type=ben；zhuan → type=zhuan；多条记录时取 id 最小的一条
   *
   * @param provinceName 省份名称
   * @param year 招生年份（与 provinces.year 解析结果一致）
   * @param eduLevelRaw 原始教育层次参数（ben / gaoben / zhuan）
   */
  async resolveEnrollTypeFromEduLevel(
    provinceName: string,
    year: string,
    eduLevelRaw?: string,
  ): Promise<string | undefined> {
    const raw = eduLevelRaw?.trim().toLowerCase();
    if (!raw) {
      return undefined;
    }
    /** 与 enroll-plan 中 province_batch.type 一致：本科 ben、专科 zhuan */
    let batchType: 'ben' | 'zhuan' | undefined;
    if (raw === 'zhuan') {
      batchType = 'zhuan';
    } else if (raw === 'ben' || raw === 'gaoben') {
      batchType = 'ben';
    } else {
      return undefined;
    }

    const row = await this.provinceBatchRepository.findOne({
      where: {
        province: provinceName.trim(),
        year,
        type: batchType,
      },
      order: { id: 'ASC' },
      select: ['batch'],
    });
    return row?.batch;
  }

  /**
   * 根据省份名称解析招生年份
   */
  async resolveEnrollmentYearByProvinceName(provinceName: string): Promise<string> {
    const trimmed = provinceName?.trim();
    if (!trimmed) {
      return this.configService.get<string>('CURRENT_YEAR') || '2025';
    }
    const row = await this.provinceRepository.findOne({
      where: { name: trimmed },
      select: ['year'],
    });
    return row?.year || this.configService.get<string>('CURRENT_YEAR') || '2025';
  }

  /**
   * 不传用户表，由参数构造选科上下文后查询
   */
  async findEnrollmentPlansByMajorIdForKiosk(
    majorId: number,
    year: string,
    province: string,
    preferredSubjects: string,
    secondarySubjectsParam: string,
    enrollType: string | undefined,
    minScore?: number,
    maxScore?: number,
  ): Promise<EnrollmentPlansByScoreRangeDto> {
    const p = province?.trim() || '';
    const user = {
      province: p,
      preferredSubjects: preferredSubjects?.trim() ?? '',
      secondarySubjects: secondarySubjectsParam ?? '',
      enrollType: enrollType?.trim() ?? '',
      rank: 0,
    } as User;
    const provinceNames = p ? [p] : [];
    const rank = user.rank ?? 0;

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
        `"ms"."school_code"::varchar = "ep"."school_code"
         AND "ms"."province"::varchar = "ep"."province"
         AND (
           "ms"."batch"::varchar = "ep"."batch"
           OR (
             CAST(:aliasBatch AS varchar) IS NOT NULL
             AND "ms"."batch"::varchar = CAST(:aliasBatch AS varchar)
           )
           OR (
             :isZhejiang = true
             AND (
               (
                 :zhejiangEmptyEnroll = true
                 AND "ms"."batch"::varchar IN (:...zhejiangDefaultBatches)
               )
               OR (
                 :zhejiangEnrollSegment1 = true
                 AND "ms"."batch"::varchar IN (:...zhejiangSegment1Batches)
               )
               OR (
                 :zhejiangEnrollSegment2 = true
                 AND "ms"."batch"::varchar IN (:...zhejiangSegment2Batches)
               )
             )
           )
         )
         AND (
           "ms"."subject_selection_mode"::varchar = "ep"."subject_selection_mode"
           OR (
             "ep"."province" IN ('云南','陕西','青海','宁夏','四川','山西','内蒙古','河南','吉林','黑龙江','安徽','江西','广西','贵州','甘肃')
             AND (
               ("ep"."subject_selection_mode" = '物理类' AND "ms"."subject_selection_mode"::varchar = '理科')
               OR
               ("ep"."subject_selection_mode" = '历史类' AND "ms"."subject_selection_mode"::varchar = '文科')
             )
           )
         )
         AND "ms"."enrollment_major" = "ep"."enrollment_major"
         AND "ms"."enrollment_type" = "ep"."enrollment_type"
         AND "ms"."key_words" = "ep"."key_words" 
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
        {
          majorId,
          // 浙江省：major_scores.batch 与用户 enroll_type / 未填批次的匹配
          isZhejiang: user.province === '浙江',
          zhejiangEmptyEnroll:
            user.province === '浙江' && !(user.enrollType && user.enrollType.trim()),
          zhejiangEnrollSegment1:
            user.province === '浙江' && user.enrollType === '普通类一段',
          zhejiangEnrollSegment2:
            user.province === '浙江' && user.enrollType === '普通类二段',
          zhejiangDefaultBatches: ['普通类一段', '普通类二段'],
          zhejiangSegment1Batches: ['普通类一段', '平行录取一段'],
          zhejiangSegment2Batches: ['普通类二段', '平行录取二段'],
          aliasBatch:
            ({
              云南: { 本科批B段: '本科一批' },
              陕西: { 本科批: '本科一批' },
              青海: { 本科批: '本科一段' },
              宁夏: { 本科批B段: '本科一批' },
              四川: { 本科批B段: '本科一批' },
              山西: { 本科批: '本科一批A段' },
              内蒙古: { 本科批: '本科一批' },
              河南: { 本科批: '本科一批' },
              吉林: { 本科批: '本科一批' },
              黑龙江: { 本科批: '本科一批A段' },
              安徽: { 本科批: '本科一批' },
              江西: { 本科批: '本科一批' },
              广西: { 本科批: '本科一批' },
              贵州: { 本科批: '本科一批' },
              甘肃: { 本科批C段: '本科一批I段' },
            } as Record<string, Record<string, string>>)[user.province]?.[
              user.enrollType || ''
            ] ?? null,
        },
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
      // 招生计划省份（与用户传入 province 一致）
      .where('ep.province = :province', { province: user.province });

    // 批次条件（从用户的 enrollType 获取）（索引顺序：province → batch）
    if (user.enrollType) {
      const batch =
        user.province === '浙江' ? '普通类平行录取' : user.enrollType;
      queryBuilder.andWhere('ep.batch = :batch', { batch });
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
          rankDiff: rawData['ms_min_rank'] - rank > 0 ? `比我低-位` : rawData['ms_min_rank'] - rank < 0 ? `比我高-位` : '与我相同',
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

        // 简化的 majorScores（按 year 倒序）
        const majorScoresSimple: MajorScoreSimpleDto[] = [...ep.majorScores]
          .sort((a, b) => {
            const aYear = Number(a.year ?? -Infinity);
            const bYear = Number(b.year ?? -Infinity);
            if (Number.isFinite(aYear) && Number.isFinite(bYear)) {
              return bYear - aYear;
            }
            return String(b.year ?? '').localeCompare(String(a.year ?? ''));
          })
          .map(
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

    /** 按每个学校下各 plan 的 majorScores 最后一项的 minRank 排序：key 越小越靠后，Infinity 排最后；预计算 key 一次 O(n)，再排序 O(n log n) */
    const sortByLastMinRank = (arr: { plans?: any[] }[]) => {
      if (arr.length <= 1) return;
      const withKey = arr.map((item) => {
        const plans = item.plans ?? [];
        let key = Infinity;
        for (let i = 0; i < plans.length; i++) {
          const scores = plans[i]?.majorScores;
          const lastRank =
            scores?.length > 0 ? scores[scores.length - 1]?.minRank ?? Infinity : Infinity;
          const val = lastRank == null ? Infinity : Number(lastRank);
          if (Number.isFinite(val) && val < key) key = val;
        }
        return { item, key };
      });
      // minRank 越小的学校排在越后；key 为 Infinity 的学校排在最后
      withKey.sort((a, b) => {
        if (a.key === Infinity && b.key === Infinity) return 0;
        if (a.key === Infinity) return 1;
        if (b.key === Infinity) return -1;
        return b.key - a.key;
      });
      arr.length = 0;
      arr.push(...withKey.map((x) => x.item));
    };

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

          // 按「每个学校下各 plan 的 majorScores 最后一项的 minRank」排序：预计算 key 一次，再排序，保证 O(n) 取键 + O(n log n) 排序
          sortByLastMinRank(inRange);
          sortByLastMinRank(notInRange);

          return { inRange, notInRange };
        })()
      : (() => {
          sortByLastMinRank(simplifiedResults);
          return { inRange: simplifiedResults, notInRange: [] };
        })();

    const totalPlans = simplifiedResults.reduce(
      (sum, school) => sum + school.plans.length,
      0,
    );
    this.logger.log(
      `自助终端 查询专业ID ${majorId} 的招生计划，找到 ${simplifiedResults.length} 所学校，共 ${totalPlans} 个招生计划（原始 raw 数据 ${raw.length} 条）`,
    );

    // 使用 plainToInstance 转换，使 @Transform 装饰器生效
    const result = plainToInstance(EnrollmentPlansByScoreRangeDto, groupedResult, {
      excludeExtraneousValues: true,
    });

    // 添加 provinces 数组
    (result as any).provinces = provinceNames;

    return result;

  }
}
