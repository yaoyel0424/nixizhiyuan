import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Choice } from '@/entities/choices.entity';
import { User } from '@/entities/user.entity';
import { MajorGroup } from '@/entities/major-group.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorScore } from '@/entities/major-score.entity';
import { Major } from '@/entities/major.entity';
import { ScoresService } from '@/scores/scores.service';
import { CreateChoiceDto } from './dto/create-choice.dto';
import { ChoiceResponseDto } from './dto/choice-response.dto';
import { GroupedChoiceResponseDto, SchoolGroupDto, MajorGroupGroupDto, ChoiceInGroupDto, VolunteerStatisticsDto } from './dto/grouped-choice-response.dto'; 
import { PROVINCE_NAME_TO_CODE, PROVINCE_CODE_TO_VOLUNTEER_COUNT } from '@/config/province';
import { plainToInstance } from 'class-transformer';
import { IdTransformUtil } from '@/common/utils/id-transform.util';

/**
 * 生成 advisory lock 的 key（同一用户同一年创建志愿串行，避免同专业组下 majorIndex 并发重复）
 */
function lockKeyForUserAndYear(userId: number, year: string): number {
  let h = 0;
  const str = `${userId}:${year}`;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 志愿选择服务
 * 处理用户志愿选择相关的业务逻辑
 */
@Injectable()
export class ChoicesService {
  private readonly logger = new Logger(ChoicesService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MajorGroup)
    private readonly majorGroupRepository: Repository<MajorGroup>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolDetail)
    private readonly schoolDetailRepository: Repository<SchoolDetail>,
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
    private readonly scoresService: ScoresService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 创建志愿选择
   * @param userId 用户ID
   * @param createChoiceDto 创建志愿的 DTO
   * @returns 创建的志愿选择记录
   */
  async create(
    userId: number,
    createChoiceDto: CreateChoiceDto,
  ): Promise<ChoiceResponseDto> {
    const year = this.configService.get<string>('CURRENT_YEAR') || '2025';
    const lockKey = lockKeyForUserAndYear(userId, year);

    return await this.dataSource.transaction(async (manager) => {
      // 创建时加锁：同一用户同年并发创建串行化，避免同专业组下 majorIndex 重复（PostgreSQL 事务级 advisory lock，提交/回滚后自动释放）
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // 1. 获取用户信息
      const user = await manager.findOne(User, { where: { id: userId } });

      if (!user) {
        this.logger.warn(`用户不存在: ${userId}`);
        throw new NotFoundException('用户不存在');
      }

      // 2. 从用户信息中获取字段
      const province = user.province || null;
      const enrollmentType = '普通类';
      const score = user.score || null;
      const preferredSubjects = user.preferredSubjects || null;
      const secondarySubjects = user.secondarySubjects
        ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
        : null;

      // 3. 一次查询同组志愿：用于判重 + 确定 mg_index（不按 mgId 过滤，以便不同 mgId 时 mg_index 全局递增）
      const sameGroupQueryBuilder = manager
        .createQueryBuilder(Choice, 'choice')
        .where('choice.userId = :userId', { userId })
        .andWhere('choice.province = :province', { province })
        .andWhere('choice.preferredSubjects = :preferredSubjects', {
          preferredSubjects: preferredSubjects ?? null,
        })
        .andWhere('choice.year = :year', { year });

      if (secondarySubjects && secondarySubjects.length > 0) {
        sameGroupQueryBuilder.andWhere('choice.secondarySubjects = :secondarySubjects', {
          secondarySubjects,
        });
      } else {
        sameGroupQueryBuilder.andWhere(
          '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
          { emptyArray: [] },
        );
      }

      const sameGroupChoices = await sameGroupQueryBuilder.getMany();

      // 4. 判重：batch、subjectSelectionMode、enrollmentMajor、remark 相同；专业组按 mgId 区分，院校模式按 schoolCode 区分
      const existingChoice = sameGroupChoices.find((c) => {
        const sameFields =
          (c.batch ?? null) === (createChoiceDto.batch ?? null) &&
          (c.subjectSelectionMode ?? null) === (createChoiceDto.subjectSelectionMode ?? null) &&
          (c.enrollmentMajor ?? null) === (createChoiceDto.enrollmentMajor ?? null) &&
          (c.remark ?? '') === (createChoiceDto.remark ?? '');
        if (createChoiceDto.mgId !== 0) {
          return sameFields && (c.mgId ?? null) === (createChoiceDto.mgId ?? null);
        }
        return sameFields && (c.schoolCode ?? null) === (createChoiceDto.schoolCode ?? null);
      });

      if (existingChoice) {
        this.logger.warn(
          `用户 ${userId} 尝试添加重复的志愿选择，已存在的记录ID: ${existingChoice.id}`,
        );
        throw new ConflictException('您已经添加了该志愿');
      }

      // 5. 确定 mg_index：复用仅在同一 mgId 内；新建时取全局 max+1，使不同 mgId 的志愿 mg_index 依次递增
      const sameMgIdChoices =
        createChoiceDto.mgId !== 0
          ? sameGroupChoices.filter(
              (c) => (c.mgId ?? null) === (createChoiceDto.mgId ?? null),
            )
          : [];
      const sameGroupChoice =
        sameMgIdChoices.length > 0
          ? sameMgIdChoices.reduce(
              (min, c) =>
                (c.mgIndex ?? 999999) < (min.mgIndex ?? 999999) ? c : min,
              sameMgIdChoices[0],
            )
          : null;

      let mgIndex: number;
      if (createChoiceDto.mgId === 0) {
        // 院校模式：不复用 mg_index，直接取最大 + 1
        const maxMgIndex = sameGroupChoices.length
          ? Math.max(0, ...sameGroupChoices.map((c) => c.mgIndex ?? 0))
          : 0;
        mgIndex = maxMgIndex + 1;
        this.logger.log(
          `用户 ${userId} 院校模式创建志愿，mg_index: ${mgIndex}`,
        );
      } else if (sameGroupChoice && sameGroupChoice.mgIndex != null) {
        mgIndex = sameGroupChoice.mgIndex;
        this.logger.log(
          `用户 ${userId} 在相同专业组下创建志愿，复用 mg_index: ${mgIndex}`,
        );
      } else {
        const maxMgIndex = sameGroupChoices.length
          ? Math.max(0, ...sameGroupChoices.map((c) => c.mgIndex ?? 0))
          : 0;
        mgIndex = maxMgIndex + 1;
        this.logger.log(
          `用户 ${userId} 创建新的专业组志愿，新 mg_index: ${mgIndex}`,
        );
      }

      // 6. 确定 major_index
      const choicesWithSameMgIndex = sameGroupChoices.filter(
        (c) => c.mgIndex === mgIndex,
      );
      const maxMajorIndex =
        choicesWithSameMgIndex.length > 0
          ? Math.max(0, ...choicesWithSameMgIndex.map((c) => c.majorIndex ?? 0))
          : 0;
      const majorIndex = maxMajorIndex + 1;

      // 6.1 检查该 mg_index 下是否已有 6 个专业
      const existingChoicesCount = choicesWithSameMgIndex.length;

      if (existingChoicesCount >= 6) {
        this.logger.warn(
          `用户 ${userId} 尝试在 mg_index ${mgIndex} 下创建第 ${existingChoicesCount + 1} 个专业，超过最大限制 6 个`,
        );
        throw new BadRequestException('每个专业组下最多只能添加 6 个专业');
      }

      this.logger.log(
        `用户 ${userId} 创建志愿，mg_index: ${mgIndex}, major_index: ${majorIndex}`,
      );

      // 7. 创建并保存志愿选择记录
      const choice = manager.create(Choice, {
        userId,
        mgId: createChoiceDto.mgId ?? null,
        mgIndex,
        schoolCode: createChoiceDto.schoolCode ?? null,
        year,
        enrollmentMajor: createChoiceDto.enrollmentMajor ?? null,
        province,
        batch: createChoiceDto.batch ?? null,
        enrollmentType,
        score,
        preferredSubjects,
        secondarySubjects,
        rank: createChoiceDto.rank ?? null,
        majorGroupInfo: createChoiceDto.majorGroupInfo ?? null,
        subjectSelectionMode: createChoiceDto.subjectSelectionMode ?? null,
        studyPeriod: createChoiceDto.studyPeriod ?? null,
        enrollmentQuota: createChoiceDto.enrollmentQuota ?? null,
        remark: createChoiceDto.remark ?? '',
        tuitionFee: createChoiceDto.tuitionFee ?? null,
        curUnit: createChoiceDto.curUnit ?? null,
        majorIndex,
        majorScores: createChoiceDto.majorScores ?? null,
      });

      const savedChoice = await manager.save(Choice, choice);

      this.logger.log(`用户 ${userId} 创建志愿选择成功，ID: ${savedChoice.id}`);

      const responseData = {
        ...savedChoice,
        majorGroupId: savedChoice.mgId,
        majorGroup: null,
        majorScores: savedChoice.majorScores || [],
        school: null,
      };

      return plainToInstance(ChoiceResponseDto, responseData, {
        excludeExtraneousValues: true,
      });
    });
  }

  /**
   * 获取用户的志愿选择列表（分组）
   * @param userId 用户ID
   * @param year 年份，如果不传则从配置中读取
   * @returns 分组后的志愿选择列表
   */
  async findByUser(
    userId: number,
    year?: string,
  ): Promise<GroupedChoiceResponseDto> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const rank = user?.rank ?? 0;

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 确定年份
    const queryYear = year || this.configService.get<string>('CURRENT_YEAR') || '2025';

    // 3. 准备查询条件
    // 从用户信息中获取：province, enrollType (对应 batch), preferredSubjects, secondarySubjects
    const province = user.province || null;
    const batch = user.enrollType || null; // enrollType 对应 batch
    const preferredSubjects = user.preferredSubjects || null;
    // secondarySubjects 在 user 中是字符串（逗号分隔），需要转换为数组
    const secondarySubjects = user.secondarySubjects
      ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
      : null;

    // 4. 构建查询条件：按照索引顺序 userId, province, preferredSubjects, year
    // 索引顺序：['userId', 'province', 'preferredSubjects', 'year']
    const queryBuilder = this.choiceRepository
      .createQueryBuilder('choice')
      .where('choice.userId = :userId', { userId });

    // 按照索引顺序添加条件
    if (province) {
      queryBuilder.andWhere('choice.province = :province', { province });
    }

    if (preferredSubjects) {
      queryBuilder.andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects,
      });
    }

    queryBuilder.andWhere('choice.year = :year', { year: queryYear });

    // 索引字段之后的其他条件
    if (batch) {
      queryBuilder.andWhere('choice.batch = :batch', { batch });
    }

    // secondarySubjects 是数组类型，需要特殊处理
    if (secondarySubjects && secondarySubjects.length > 0) {
      queryBuilder.andWhere('choice.secondarySubjects = :secondarySubjects', {
        secondarySubjects,
      });
    } else {
      queryBuilder.andWhere(
        '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        { emptyArray: [] },
      );
    }

    // 5. 关联查询所有相关数据（专业组、学校、学校详情）
    queryBuilder
      .leftJoinAndSelect('choice.majorGroup', 'majorGroup')
      .leftJoinAndSelect('choice.school', 'school')
      .leftJoinAndSelect('school.schoolDetail', 'schoolDetail');

    // 5.1. 关联 enrollment_plans 表
    queryBuilder
      .leftJoin(
        EnrollmentPlan,
        'enrollmentPlan',
        'choice.schoolCode = enrollmentPlan.schoolCode ' +
        'AND choice.province = enrollmentPlan.province ' +
        'AND choice.subjectSelectionMode = enrollmentPlan.subjectSelectionMode ' +
        'AND choice.batch = enrollmentPlan.batch ' +
        'AND choice.enrollmentType = enrollmentPlan.enrollmentType ' +
        'AND choice.year = enrollmentPlan.year ' +
        'AND enrollmentPlan.majorGroupId = choice.mgId ' +
        'AND choice.enrollmentMajor = enrollmentPlan.enrollmentMajor ' +
        'AND (choice.remark IS NOT DISTINCT FROM enrollmentPlan.remark)'
      );

    // 5.2. 关联 major_scores 表并选择需要的字段
    queryBuilder
      .leftJoin(
        MajorScore,
        'majorScore',
        'enrollmentPlan.schoolCode = majorScore.schoolCode ' +
        'AND enrollmentPlan.province = majorScore.province ' +
        'AND enrollmentPlan.batch = majorScore.batch ' +
        'AND enrollmentPlan.subjectSelectionMode = majorScore.subjectSelectionMode ' +
        'AND enrollmentPlan.enrollmentMajor = majorScore.enrollmentMajor ' +
        'AND (enrollmentPlan.keyWords IS NOT DISTINCT FROM majorScore.keyWords) ' +
        'AND enrollmentPlan.enrollmentType = majorScore.enrollmentType '  
      )
      .addSelect('choice.id', 'choice_id')
      .addSelect('majorScore.schoolCode', 'major_score_school_code')
      .addSelect('majorScore.province', 'major_score_province')
      .addSelect('majorScore.subjectSelectionMode', 'major_score_subject_selection_mode')
      .addSelect('majorScore.year', 'major_score_year')
      .addSelect('majorScore.enrollmentType', 'major_score_enrollment_type')
      .addSelect('majorScore.minScore', 'major_score_min_score')
      .addSelect('majorScore.minRank', 'major_score_min_rank')
      .addSelect('majorScore.batch', 'major_score_batch')
      .addSelect('majorScore.admitCount', 'major_score_admit_count')
      .addSelect('enrollmentPlan.level3MajorId', 'enrollment_plan_level3_major_id');

    // 6. 查询用户的志愿选择列表（包含关联数据）
    const { entities: choices, raw } = await queryBuilder
      .orderBy('choice.createdAt', 'DESC') // 按创建时间倒序排列，最新的在前
      .getRawAndEntities();

    // 6.1. 处理 major_scores 数据，按 choice.id 分组
    const majorScoresMap = new Map<number, any[]>();
    for (const row of raw) {
      const choiceId = row.choice_id;
      if (row.major_score_school_code !== null) {
        const rankDiff = row.major_score_min_rank - rank;
        const rankDiffText =
          rankDiff > 0
            ? `比我低${rankDiff} 位`
            : rankDiff < 0
              ? `比我高${Math.abs(rankDiff)} 位`
              : '与我相同';
        if (!majorScoresMap.has(choiceId)) {
          majorScoresMap.set(choiceId, []);
        }
        majorScoresMap.get(choiceId)!.push({
          schoolCode: row.major_score_school_code,
          province: row.major_score_province,
          subjectSelectionMode: row.major_score_subject_selection_mode,
          year: row.major_score_year,
          enrollmentType: row.major_score_enrollment_type,
          minScore: row.major_score_min_score,
          minRank: row.major_score_min_rank,
          batch: row.major_score_batch,
          admitCount: row.major_score_admit_count,
          rank: rank,
          rankDiff: rankDiffText,
        });
      }
    }

    // 6.2. 将 major_scores 数据附加到 choices 实体，并按 year 排序
    for (const choice of choices) {
      const majorScores = majorScoresMap.get(choice.id) || [];
      // 按 year 降序排序（最新的年份在前）
      majorScores.sort((a, b) => {
        if (a.year === null || a.year === undefined) return 1;
        if (b.year === null || b.year === undefined) return -1;
        return b.year.localeCompare(a.year);
      });
      (choice as any).majorScoresFromJoin = majorScores;
    }

    // 6.3. 收集所有唯一的 level3_major_id
    const level3MajorIdSet = new Set<number>();
    for (const row of raw) {
      const level3MajorIds = row.enrollment_plan_level3_major_id;
      if (level3MajorIds && Array.isArray(level3MajorIds) && level3MajorIds.length > 0) {
        level3MajorIds.forEach((id: number) => {
          if (id !== null && id !== undefined) {
            level3MajorIdSet.add(id);
          }
        });
      }
    }

    // 6.4. 查询 majors 表获取专业信息
    const majorIdToInfoMap = new Map<number, { code: string; name: string }>();
    if (level3MajorIdSet.size > 0) {
      const majorIds = Array.from(level3MajorIdSet);
      const majors = await this.majorRepository.find({
        where: {
          id: In(majorIds),
          level: 3,
        },
        select: ['id', 'code', 'name'],
      });

      for (const major of majors) {
        majorIdToInfoMap.set(major.id, {
          code: major.code,
          name: major.name,
        });
      }
    }

    // 6.5. 计算专业分数
    const majorCodeToScoreMap = new Map<string, number>();
    if (majorIdToInfoMap.size > 0) {
      const majorCodes = Array.from(majorIdToInfoMap.values()).map((info) => info.code);
      try {
        const scoreResults = await this.scoresService.calculateScores(userId, undefined, majorCodes);
        for (const result of scoreResults) {
          majorCodeToScoreMap.set(result.majorCode, result.score);
        }
      } catch (error) {
        this.logger.warn(`计算专业分数失败: ${error.message}`);
        // 继续执行，分数将为 null
      }
    }

    // 6.6. 处理每个 choice 的 level3_major_id，构建 scores 数组
    // 使用 Map 存储每个 choice 的 majorId Set，避免重复
    const choiceMajorIdSetMap = new Map<number, Set<number>>();
    for (const row of raw) {
      const choiceId = row.choice_id;
      const level3MajorIds = row.enrollment_plan_level3_major_id;

      if (level3MajorIds && Array.isArray(level3MajorIds) && level3MajorIds.length > 0) {
        if (!choiceMajorIdSetMap.has(choiceId)) {
          choiceMajorIdSetMap.set(choiceId, new Set<number>());
        }

        const majorIdSet = choiceMajorIdSetMap.get(choiceId)!;
        for (const majorId of level3MajorIds) {
          if (majorId !== null && majorId !== undefined) {
            majorIdSet.add(majorId);
          }
        }
      }
    }

    // 6.6.1. 将去重后的 majorId Set 转换为 scores 数组
    const choiceScoresMap = new Map<number, Array<{ majorName: string; score: number | null }>>();
    for (const [choiceId, majorIdSet] of choiceMajorIdSetMap.entries()) {
      const scores: Array<{ majorName: string; score: number | null }> = [];
      for (const majorId of majorIdSet) {
        const majorInfo = majorIdToInfoMap.get(majorId);
        if (majorInfo) {
          const score = majorCodeToScoreMap.get(majorInfo.code) ?? null;
          scores.push({
            majorName: majorInfo.name,
            score: score,
          });
        }
      }
      choiceScoresMap.set(choiceId, scores);
    }

    // 6.7. 将 scores 数据附加到 choices 实体
    for (const choice of choices) {
      (choice as any).scoresFromLevel3 = choiceScoresMap.get(choice.id) || [];
    }

    if (choices.length === 0) {
      this.logger.log(`用户 ${userId} 在 ${queryYear} 年没有志愿选择记录`);
      // 返回空数据，但包含统计信息
      const provinceCode = user.province ? PROVINCE_NAME_TO_CODE[user.province] : null;
      const totalCount = provinceCode ? (PROVINCE_CODE_TO_VOLUNTEER_COUNT[provinceCode] || 0) : 0;
      const emptyResponse = {
        volunteers: [],
        statistics: {
          selected: 0,
          total: totalCount,
        },
      };
      return plainToInstance(GroupedChoiceResponseDto, emptyResponse, {
        excludeExtraneousValues: true,
      });
    }

    // 7. 定义数据转换辅助函数（用于将实体转换为 DTO 格式，手动处理 ID 编码）
    const buildChoiceInGroup = (choice: Choice) => ({
      id: choice.id,
      userId: choice.userId,
      schoolCode: choice.schoolCode || '',
      majorGroupId: choice.mgId ? IdTransformUtil.encode(choice.mgId) : null,
      mgIndex: choice.mgIndex,
      majorIndex: choice.majorIndex,
      majorGroupInfo: choice.majorGroupInfo,
      province: choice.province,
      year: choice.year,
      batch: choice.batch,
      subjectSelectionMode: choice.subjectSelectionMode,
      studyPeriod: choice.studyPeriod,
      enrollmentQuota: choice.enrollmentQuota,
      enrollmentType: choice.enrollmentType,
      remark: choice.remark,
      tuitionFee: choice.tuitionFee,
      enrollmentMajor: choice.enrollmentMajor,
      curUnit: choice.curUnit,
      majorScores: ((choice as any).majorScoresFromJoin || []).map((score: any) => ({
        schoolCode: score.schoolCode,
        province: score.province,
        year: score.year,
        subjectSelectionMode: score.subjectSelectionMode,
        batch: score.batch,
        minScore: score.minScore,
        minRank: score.minRank,
        admitCount: score.admitCount,
        enrollmentType: score.enrollmentType,
        rankDiff: score.rankDiff,
      })),
      scores: ((choice as any).scoresFromLevel3 || []).map((item: { majorName: string; score: number | null }) => ({
        majorName: item.majorName,
        score: item.score,
      })),
    });

    const buildMajorGroupSimple = (majorGroup: MajorGroup) => ({
      schoolCode: majorGroup.schoolCode,
      province: majorGroup.province,
      year: majorGroup.year,
      subjectSelectionMode: majorGroup.subjectSelectionMode,
      batch: majorGroup.batch,
      mgId: majorGroup.mgId ? IdTransformUtil.encode(majorGroup.mgId) : null,
      mgName: majorGroup.mgName,
      mgInfo: majorGroup.mgInfo,
    });

    const buildSchoolSimple = (school: School, schoolDetail: SchoolDetail | null) => ({
      code: school.code,
      name: school.name,
      nature: school.nature,
      level: school.level,
      belong: school.belong,
      categories: school.categories,
      features: school.features,
      provinceName: school.provinceName,
      cityName: school.cityName,
      enrollmentRate: schoolDetail?.enrollmentRate ?? null,
      employmentRate: schoolDetail?.employmentRate ?? null,
    });

    // 8. 按 mgIndex 分组并构建响应结构（同时计算统计信息）
    // 8.1 将所有 choices 按 mgIndex 分组（统一处理，不区分是否有 majorGroup）
    const mgIndexGroupsMap = new Map<number, Choice[]>();
    const uniqueMgIndexes = new Set<number>();

    for (const choice of choices) {
      if (choice.mgIndex === null || choice.mgIndex === undefined) {
        continue;
      }
      const mgIndex = choice.mgIndex;
      uniqueMgIndexes.add(mgIndex);
      if (!mgIndexGroupsMap.has(mgIndex)) {
        mgIndexGroupsMap.set(mgIndex, []);
      }
      mgIndexGroupsMap.get(mgIndex)!.push(choice);
    }

    // 8.2 构建分组结构：按 mgIndex 排序后，每个 mgIndex 下按 mgId 分组，再按 majorIndex 排序
    const grouped = Array.from(mgIndexGroupsMap.entries())
      .sort(([mgIndexA], [mgIndexB]) => (mgIndexA || 0) - (mgIndexB || 0))
      .map(([mgIndex, mgChoices]) => {
        const firstChoice = mgChoices[0];
        if (!firstChoice.school) {
          return null;
        }

        const schoolDto = buildSchoolSimple(
          firstChoice.school,
          firstChoice.school.schoolDetail || null,
        );

        // 按 mgId 进行二级分组（有 majorGroup 的情况）
        if (firstChoice.majorGroup) {
          const majorGroupsMap = new Map<number, Choice[]>();
          for (const choice of mgChoices) {
            if (!choice.mgId) {
              this.logger.warn(`mgIndex ${mgIndex} 下的 choice ${choice.id} 的 mgId 为空`);
              continue;
            }
            if (!majorGroupsMap.has(choice.mgId)) {
              majorGroupsMap.set(choice.mgId, []);
            }
            majorGroupsMap.get(choice.mgId)!.push(choice);
          }

          // 按 mgId 排序后构建 majorGroups
          // 先构建所有 majorGroups 的信息
          const majorGroups = Array.from(majorGroupsMap.entries())
            .sort(([mgIdA], [mgIdB]) => (mgIdA || 0) - (mgIdB || 0))
            .map(([mgId, groupChoices]) => {
              const firstChoiceInGroup = groupChoices[0];
              if (!firstChoiceInGroup.majorGroup) {
                return null;
              }
              // 按 majorIndex 排序
              groupChoices.sort((a, b) => (a.majorIndex || 0) - (b.majorIndex || 0));
              // 先构建 majorGroup，然后构建 choices，确保在序列化时先显示 majorGroup
              const majorGroupData = buildMajorGroupSimple(firstChoiceInGroup.majorGroup);
              const choicesData = groupChoices.map(buildChoiceInGroup);
              return {
                majorGroup: majorGroupData,
                choices: choicesData,
              };
            })
            .filter((item): item is any => item !== null);

          return {
            mgIndex,
            school: schoolDto,
            majorGroups,
          };
        } else {
          // 没有 majorGroup 的情况
          return {
            mgIndex,
            school: schoolDto,
            majorGroups: [
              {
                majorGroup: null,
                choices: mgChoices.map(buildChoiceInGroup),
              },
            ],
          };
        }
      })
      .filter((item): item is any => item !== null);

    // 9. 构建最终响应（包含分组数据和统计信息）
    const provinceCode = user.province ? PROVINCE_NAME_TO_CODE[user.province] : null;
    const totalCount = provinceCode ? (PROVINCE_CODE_TO_VOLUNTEER_COUNT[provinceCode] || 0) : 0;

    return plainToInstance(
      GroupedChoiceResponseDto,
      {
        volunteers: grouped,
        statistics: {
          selected: uniqueMgIndexes.size,
          total: totalCount,
        },
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );
  }

  /**
   * 删除志愿选择
   * @param userId 用户ID
   * @param choiceId 志愿选择ID
   * @returns void
   */
  async remove(userId: number, choiceId: number): Promise<void> {
    // 1. 查找志愿选择记录，并验证是否属于当前用户
    const choice = await this.choiceRepository.findOne({
      where: {
        id: choiceId,
        userId, // 确保只能删除自己的志愿
      },
    });

    if (!choice) {
      this.logger.warn(
        `用户 ${userId} 尝试删除不存在的志愿选择或不属于自己的志愿，ID: ${choiceId}`,
      );
      throw new NotFoundException('志愿选择不存在或不属于当前用户');
    }

    // 2. 删除记录
    await this.choiceRepository.remove(choice);

    this.logger.log(`用户 ${userId} 删除志愿选择成功，ID: ${choiceId}`);
  }

  /**
   * 批量删除志愿选择
   * @param userId 用户ID
   * @param ids 要删除的志愿选择ID数组
   * @returns 删除结果（成功删除的数量和失败的ID列表）
   */
  async removeMultiple(
    userId: number,
    ids: number[],
  ): Promise<{ deleted: number; failed: number[] }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('至少需要提供一个ID');
    }

    // 1. 查找所有属于当前用户的志愿选择记录
    const choices = await this.choiceRepository.find({
      where: {
        id: In(ids),
        userId, // 确保只能删除自己的志愿
      },
    });

    // 2. 找出不存在的或不属于当前用户的ID
    const foundIds = choices.map((choice) => choice.id);
    const failedIds = ids.filter((id) => !foundIds.includes(id));

    if (failedIds.length > 0) {
      this.logger.warn(
        `用户 ${userId} 尝试删除不存在的志愿选择或不属于自己的志愿，IDs: ${failedIds.join(', ')}`,
      );
    }

    // 3. 删除找到的记录
    if (choices.length > 0) {
      await this.choiceRepository.remove(choices);
      this.logger.log(
        `用户 ${userId} 批量删除志愿选择成功，删除 ${choices.length} 条记录，失败 ${failedIds.length} 条`,
      );
    }

    return {
      deleted: choices.length,
      failed: failedIds,
    };
  }

  /**
   * 调整索引（上移或下移）
   * @param userId 用户ID
   * @param choiceId 志愿选择ID
   * @param indexType 调整类型：mg_index 或 major_index
   * @param direction 调整方向：up 或 down
   * @returns 更新后的志愿选择记录
   */
  /**
   * 调整 mg_index（专业组索引）
   * @param userId 用户ID
   * @param mgIndex 专业组索引
   * @param direction 调整方向：up（上移）或 down（下移）
   * @returns 更新后的记录数量
   */
  async adjustMgIndex(
    userId: number,
    mgIndex: number,
    direction: 'up' | 'down',
  ): Promise<{ updated: number }> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 从用户信息中获取字段
    const province = user.province || null;
    const preferredSubjects = user.preferredSubjects || null;
    const secondarySubjects = user.secondarySubjects
      ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
      : null;
    const year = this.configService.get<string>('CURRENT_YEAR') || '2025';

    if (!province) {
      throw new BadRequestException('用户未设置省份信息');
    }

    if (!preferredSubjects) {
      throw new BadRequestException('用户未设置首选科目信息');
    }

    const lockKey = lockKeyForUserAndYear(userId, year);

    return await this.dataSource.transaction(async (manager) => {
      // 移动 mgIndex 时加锁，与创建/移动 majorIndex 串行，避免索引并发冲突
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      const targetIndex = direction === 'up' ? -1 : 1;
      const targetMgIndex = mgIndex + targetIndex;

      if (targetMgIndex < 1) {
        throw new BadRequestException('已经是第一个，无法上移');
      }

      const choicesQueryBuilder = manager
        .getRepository(Choice)
        .createQueryBuilder('choice')
        .where('choice.userId = :userId', { userId })
        .andWhere('choice.province = :province', { province })
        .andWhere('choice.preferredSubjects = :preferredSubjects', {
          preferredSubjects: preferredSubjects ?? null,
        })
        .andWhere('choice.year = :year', { year })
        .andWhere('choice.mgIndex IN (:...mgIndexes)', {
          mgIndexes: [mgIndex, targetMgIndex],
        });

      if (secondarySubjects && secondarySubjects.length > 0) {
        choicesQueryBuilder.andWhere(
          'choice.secondarySubjects = :secondarySubjects',
          { secondarySubjects },
        );
      } else {
        choicesQueryBuilder.andWhere(
          '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
          { emptyArray: [] },
        );
      }

      const allChoices = await choicesQueryBuilder.getMany();
      const currentChoices = allChoices.filter((c) => c.mgIndex === mgIndex);
      const targetChoices = allChoices.filter((c) => c.mgIndex === targetMgIndex);

      if (currentChoices.length === 0) {
        throw new NotFoundException('未找到对应的志愿选择记录');
      }

      if (targetChoices.length === 0) {
        throw new BadRequestException(
          direction === 'up'
            ? '已经是第一个，无法上移'
            : '已经是最后一个，无法下移',
        );
      }

      // 使用临时占位 mg_index 分步交换，避免违反 (user_id, mg_index, major_index) 唯一约束的中间状态
      const tempMgIndex = 0; // 业务上 mg_index 从 1 开始，0 用作交换时的临时值
      for (const choice of currentChoices) {
        choice.mgIndex = tempMgIndex;
      }
      await manager.save(Choice, currentChoices);

      for (const choice of targetChoices) {
        choice.mgIndex = mgIndex;
      }
      await manager.save(Choice, targetChoices);

      for (const choice of currentChoices) {
        choice.mgIndex = targetMgIndex;
      }
      await manager.save(Choice, currentChoices);

      this.logger.log(
        `用户 ${userId} 调整 mg_index，从 ${mgIndex} ${direction === 'up' ? '上移' : '下移'} 到 ${targetMgIndex}，更新了 ${currentChoices.length + targetChoices.length} 条记录`,
      );

      return { updated: currentChoices.length + targetChoices.length };
    });
  }

  /**
   * 调整 major_index（专业索引）
   * @param userId 用户ID
   * @param choiceId 志愿选择ID
   * @param direction 调整方向：up（上移）或 down（下移）
   * @returns 更新后的志愿选择记录
   */
  async adjustMajorIndex(
    userId: number,
    choiceId: number,
    direction: 'up' | 'down',
  ): Promise<ChoiceResponseDto> {
    const year = this.configService.get<string>('CURRENT_YEAR') || '2025';
    const lockKey = lockKeyForUserAndYear(userId, year);

    return await this.dataSource.transaction(async (manager) => {
      // 移动 majorIndex 时加锁，与创建/移动 mgIndex 串行，避免索引并发冲突
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      const currentChoice = await manager.findOne(Choice, {
        where: {
          id: choiceId,
          userId,
        },
      });

      if (!currentChoice) {
        this.logger.warn(
          `用户 ${userId} 尝试调整不存在的志愿选择或不属于自己的志愿，ID: ${choiceId}`,
        );
        throw new NotFoundException('志愿选择不存在或不属于当前用户');
      }

      const targetIndex = direction === 'up' ? -1 : 1;
      const targetMajorIndex = (currentChoice.majorIndex ?? 0) + targetIndex;

      if (targetMajorIndex < 1) {
        throw new BadRequestException('已经是第一个，无法上移');
      }

      // 与唯一约束一致：必须在同一组（省份+选科+年份）内查找交换目标，避免跨组交换导致重复键
      const qb = manager
        .getRepository(Choice)
        .createQueryBuilder('choice')
        .where('choice.userId = :userId', { userId })
        .andWhere('choice.province = :province', { province: currentChoice.province })
        .andWhere('choice.preferredSubjects = :preferredSubjects', {
          preferredSubjects: currentChoice.preferredSubjects ?? null,
        })
        .andWhere('choice.year = :year', { year: currentChoice.year ?? null })
        .andWhere('choice.mgIndex = :mgIndex', { mgIndex: currentChoice.mgIndex })
        .andWhere('choice.majorIndex = :majorIndex', { majorIndex: targetMajorIndex });
      if (currentChoice.secondarySubjects != null && currentChoice.secondarySubjects.length > 0) {
        qb.andWhere('choice.secondarySubjects = :secondarySubjects', {
          secondarySubjects: currentChoice.secondarySubjects,
        });
      } else {
        qb.andWhere('(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)', {
          emptyArray: [],
        });
      }
      const targetChoice = await qb.getOne();

      if (!targetChoice) {
        throw new BadRequestException(
          direction === 'up'
            ? '已经是第一个，无法上移'
            : '已经是最后一个，无法下移',
        );
      }

      // 使用临时占位 major_index 分步交换，避免违反 (user_id, mg_index, major_index) 唯一约束的中间状态
      const tempMajorIndexPlaceholder = 0; // 业务上 major_index 从 1 开始，0 用作交换时的临时值
      const oldCurrent = currentChoice.majorIndex ?? 0;
      const oldTarget = targetChoice.majorIndex ?? 0;

      currentChoice.majorIndex = tempMajorIndexPlaceholder;
      await manager.save(Choice, currentChoice);

      targetChoice.majorIndex = oldCurrent;
      await manager.save(Choice, targetChoice);

      currentChoice.majorIndex = oldTarget;
      await manager.save(Choice, currentChoice);

      this.logger.log(
        `用户 ${userId} 调整志愿选择 major_index，ID: ${choiceId}，方向: ${direction}`,
      );
    }).then(() => this.getChoiceResponseDto(choiceId));
  }

  /**
   * 获取志愿选择响应 DTO（通用方法）
   * @param choiceId 志愿选择ID
   * @returns 志愿选择响应 DTO
   */
  private async getChoiceResponseDto(choiceId: number): Promise<ChoiceResponseDto> {
    // 重新查询当前记录（包含关联数据）
    const updatedChoice = await this.choiceRepository.findOne({
      where: { id: choiceId },
      relations: ['majorGroup'],
    });

    if (!updatedChoice) {
      throw new NotFoundException('更新后的记录不存在');
    }

    // 查询关联的专业组信息
    let majorGroup = null;
    if (updatedChoice.mgId) {
      majorGroup = await this.majorGroupRepository.findOne({
        where: { mgId: updatedChoice.mgId },
      });
    }

    // 查询关联的学校信息
    let school = null;
    let schoolDetail = null;
    if (updatedChoice.schoolCode) {
      school = await this.schoolRepository.findOne({
        where: { code: updatedChoice.schoolCode },
      });
      if (school) {
        schoolDetail = await this.schoolDetailRepository.findOne({
          where: { code: updatedChoice.schoolCode },
        });
      }
    }

    // 构建响应对象
    const responseData = {
      ...updatedChoice,
      majorGroupId: updatedChoice.mgId,
      majorGroup: majorGroup
        ? {
            schoolCode: majorGroup.schoolCode,
            province: majorGroup.province,
            year: majorGroup.year,
            subjectSelectionMode: majorGroup.subjectSelectionMode,
            batch: majorGroup.batch,
            mgId: majorGroup.mgId ? IdTransformUtil.encode(majorGroup.mgId) : null,
            mgName: majorGroup.mgName,
            mgInfo: majorGroup.mgInfo,
          }
        : null,
      majorScores: updatedChoice.majorScores || [],
      school: school
        ? {
            code: school.code,
            name: school.name,
            nature: school.nature,
            level: school.level,
            belong: school.belong,
            categories: school.categories,
            features: school.features,
            provinceName: school.provinceName,
            cityName: school.cityName,
            enrollmentRate: schoolDetail?.enrollmentRate ?? null,
            employmentRate: schoolDetail?.employmentRate ?? null,
          }
        : null,
    };

    // 转换为响应 DTO
    return plainToInstance(ChoiceResponseDto, responseData, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 修复所有记录的 mgIndex 和 majorIndex
   * 规则：
   * 1. mgIndex：按照 userId, province, preferredSubjects, secondarySubjects, year 分组，在每组内按照 mgId 分配递增的 mgIndex（同一 mgId 使用相同的 mgIndex）
   * 2. majorIndex：在同一个 mgIndex 下，按照创建时间递增分配 majorIndex
   * @returns 修复的记录数量
   */
  async fixAllIndexes(): Promise<{ fixed: number }> {
    this.logger.log('开始修复所有记录的 mgIndex 和 majorIndex');

    // 1. 查询所有记录，按 userId, province, preferredSubjects, secondarySubjects, year 分组
    const allChoices = await this.choiceRepository.find({
      order: {
        userId: 'ASC',
        province: 'ASC',
        preferredSubjects: 'ASC',
        year: 'ASC',
        createdAt: 'ASC', // 按创建时间排序，确保顺序一致
      },
    });

    if (allChoices.length === 0) {
      this.logger.log('没有需要修复的记录');
      return { fixed: 0 };
    }

    // 2. 按 userId, province, preferredSubjects, secondarySubjects, year 分组
    // 注意：secondarySubjects 是数组，需要特殊处理用于分组键
    const groupedByUserProvincePreferredSecondaryYear = new Map<string, Choice[]>();
    for (const choice of allChoices) {
      // 将 secondarySubjects 数组转换为排序后的字符串用于分组
      const secondarySubjectsKey = choice.secondarySubjects
        ? [...choice.secondarySubjects].sort().join(',')
        : 'null';
      const key = `${choice.userId}_${choice.province}_${choice.preferredSubjects || 'null'}_${secondarySubjectsKey}_${choice.year || 'null'}`;
      if (!groupedByUserProvincePreferredSecondaryYear.has(key)) {
        groupedByUserProvincePreferredSecondaryYear.set(key, []);
      }
      groupedByUserProvincePreferredSecondaryYear.get(key)!.push(choice);
    }

    let fixedCount = 0;

    // 3. 对每个分组进行处理
    for (const [key, choices] of groupedByUserProvincePreferredSecondaryYear.entries()) {
      // 3.1 按 mgId 分组，分配 mgIndex（同一 mgId 使用相同的 mgIndex）
      const mgIndexMap = new Map<number | null, number>();
      let currentMgIndex = 1;

      for (const choice of choices) {
        if (!mgIndexMap.has(choice.mgId)) {
          mgIndexMap.set(choice.mgId, currentMgIndex);
          currentMgIndex++;
        }
        choice.mgIndex = mgIndexMap.get(choice.mgId)!;
      }

      // 3.2 按 mgIndex 分组，分配 majorIndex
      const groupedByMgIndex = new Map<number, Choice[]>();
      for (const choice of choices) {
        if (!groupedByMgIndex.has(choice.mgIndex!)) {
          groupedByMgIndex.set(choice.mgIndex!, []);
        }
        groupedByMgIndex.get(choice.mgIndex!)!.push(choice);
      }

      // 3.3 在每个 mgIndex 组内，按创建时间排序，分配递增的 majorIndex
      for (const [mgIndex, mgChoices] of groupedByMgIndex.entries()) {
        // 按创建时间排序
        mgChoices.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }
          return 0;
        });

        // 分配递增的 majorIndex
        let currentMajorIndex = 1;
        for (const choice of mgChoices) {
          choice.majorIndex = currentMajorIndex;
          currentMajorIndex++;
        }
      }

      // 3.4 批量保存
      await this.choiceRepository.save(choices);
      fixedCount += choices.length;

      this.logger.log(
        `修复分组 ${key}，共 ${choices.length} 条记录，mgIndex 范围: 1-${currentMgIndex - 1}`,
      );
    }

    this.logger.log(`修复完成，共修复 ${fixedCount} 条记录`);
    return { fixed: fixedCount };
  }
}
