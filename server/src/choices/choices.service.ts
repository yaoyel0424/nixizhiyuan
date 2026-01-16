import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Choice } from '@/entities/choices.entity';
import { User } from '@/entities/user.entity';
import { MajorGroup } from '@/entities/major-group.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { CreateChoiceDto } from './dto/create-choice.dto';
import { ChoiceResponseDto } from './dto/choice-response.dto';
import { GroupedChoiceResponseDto, SchoolGroupDto, MajorGroupGroupDto, ChoiceInGroupDto, VolunteerStatisticsDto } from './dto/grouped-choice-response.dto';
import { SchoolSimpleDto } from '@/enroll-plan/dto/enrollment-plan-with-scores.dto';
import { PROVINCE_NAME_TO_CODE, PROVINCE_CODE_TO_VOLUNTEER_COUNT } from '@/config/province';
import { plainToInstance } from 'class-transformer';
import { IdTransformUtil } from '@/common/utils/id-transform.util';

/**
 * 志愿选择服务
 * 处理用户志愿选择相关的业务逻辑
 */
@Injectable()
export class ChoicesService {
  private readonly logger = new Logger(ChoicesService.name);

  constructor(
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
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 从配置中获取年份
    const year = this.configService.get<string>('CURRENT_YEAR') || '2025';

    // 3. 从用户信息中获取字段
    const province = user.province || null;
    const enrollmentType = "普通类";
    const score = user.score || null;
    const preferredSubjects = user.preferredSubjects || null;
    const secondarySubjects = user.secondarySubjects
      ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
      : null;

    // 4. 检查是否已存在相同的志愿选择
    // 检查条件：userId, province, year, batch, subjectSelectionMode, mgId, enrollmentMajor, remark
    const existingChoice = await this.choiceRepository.findOne({
      where: {
        userId,
        province,
        year,
        batch: createChoiceDto.batch ?? null,
        subjectSelectionMode: createChoiceDto.subjectSelectionMode ?? null,
        mgId: createChoiceDto.mgId ?? null,
        enrollmentMajor: createChoiceDto.enrollmentMajor ?? null,
        remark: createChoiceDto.remark ?? null,
      },
    });

    if (existingChoice) {
      this.logger.warn(
        `用户 ${userId} 尝试添加重复的志愿选择，已存在的记录ID: ${existingChoice.id}`,
      );
      throw new ConflictException('您已经添加了该志愿');
    }

    // 5. 确定 mg_index
    // 规则：同一用户、同一省份、同一首选科目、同一次选科目、同一年份下、同一专业组，其 mg_index 应该是一致的
    // 查询是否存在相同的 user_id, province, preferred_subjects, secondary_subjects, year, mg_id 组合
    // 注意：secondarySubjects 是数组，需要使用数组比较
    // 按照索引顺序：userId, province, preferredSubjects, year
    const sameGroupChoice = await this.choiceRepository
      .createQueryBuilder('choice')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.province = :province', { province })
      .andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects: preferredSubjects ?? null,
      })
      .andWhere('choice.year = :year', { year })
      // 索引字段之后的其他条件
      .andWhere('choice.mgId = :mgId', {
        mgId: createChoiceDto.mgId ?? null,
      })
      .andWhere(
        secondarySubjects && secondarySubjects.length > 0
          ? 'choice.secondarySubjects = :secondarySubjects'
          : '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        secondarySubjects && secondarySubjects.length > 0
          ? { secondarySubjects }
          : { emptyArray: [] },
      )
      .orderBy('choice.mgIndex', 'ASC')
      .getOne();

    let mgIndex: number;
    if (sameGroupChoice && sameGroupChoice.mgIndex !== null) {
      // 如果存在相同组合，使用已存在的 mg_index
      mgIndex = sameGroupChoice.mgIndex;
      this.logger.log(
        `用户 ${userId} 在相同专业组下创建志愿，复用 mg_index: ${mgIndex}`,
      );
    } else {
      // 如果不存在，计算该组合（userId, province, preferredSubjects, secondarySubjects, year）下的最大 mg_index
      // 按照索引顺序：userId, province, preferredSubjects, year
      const queryBuilder = this.choiceRepository
        .createQueryBuilder('choice')
        .select('MAX(choice.mgIndex)', 'max')
        .where('choice.userId = :userId', { userId })
        .andWhere('choice.province = :province', { province })
        .andWhere('choice.preferredSubjects = :preferredSubjects', {
          preferredSubjects: preferredSubjects ?? null,
        })
        .andWhere('choice.year = :year', { year });

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

      const maxMgIndexResult = await queryBuilder.getRawOne();

      const maxMgIndex = maxMgIndexResult?.max
        ? parseInt(maxMgIndexResult.max, 10)
        : 0;
      mgIndex = maxMgIndex + 1;
      this.logger.log(
        `用户 ${userId} 创建新的专业组志愿，新 mg_index: ${mgIndex}`,
      );
    }

    // 6. 确定 major_index
    // 基于已确定的 mg_index，查询该 mg_index 下的最大 major_index
    // 需要在相同的分组条件下（userId, province, preferredSubjects, secondarySubjects, year）
    // 按照索引顺序：userId, province, preferredSubjects, year
    const majorIndexQueryBuilder = this.choiceRepository
      .createQueryBuilder('choice')
      .select('MAX(choice.majorIndex)', 'max')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.province = :province', { province })
      .andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects: preferredSubjects ?? null,
      })
      .andWhere('choice.year = :year', { year })
      // 索引字段之后的其他条件
      .andWhere('choice.mgIndex = :mgIndex', { mgIndex });

    if (secondarySubjects && secondarySubjects.length > 0) {
      majorIndexQueryBuilder.andWhere(
        'choice.secondarySubjects = :secondarySubjects',
        { secondarySubjects },
      );
    } else {
      majorIndexQueryBuilder.andWhere(
        '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        { emptyArray: [] },
      );
    }

    const maxMajorIndexResult = await majorIndexQueryBuilder.getRawOne();

    const maxMajorIndex = maxMajorIndexResult?.max
      ? parseInt(maxMajorIndexResult.max, 10)
      : 0;
    const majorIndex = maxMajorIndex + 1;

    // 6.1 检查该 mg_index 下是否已经有 6 个专业
    // 需要在相同的分组条件下（userId, province, preferredSubjects, secondarySubjects, year）
    // 按照索引顺序：userId, province, preferredSubjects, year
    const countQueryBuilder = this.choiceRepository
      .createQueryBuilder('choice')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.province = :province', { province })
      .andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects: preferredSubjects ?? null,
      })
      .andWhere('choice.year = :year', { year })
      // 索引字段之后的其他条件
      .andWhere('choice.mgIndex = :mgIndex', { mgIndex });

    if (secondarySubjects && secondarySubjects.length > 0) {
      countQueryBuilder.andWhere(
        'choice.secondarySubjects = :secondarySubjects',
        { secondarySubjects },
      );
    } else {
      countQueryBuilder.andWhere(
        '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        { emptyArray: [] },
      );
    }

    const existingChoicesCount = await countQueryBuilder.getCount();

    if (existingChoicesCount >= 6) {
      this.logger.warn(
        `用户 ${userId} 尝试在 mg_index ${mgIndex} 下创建第 ${existingChoicesCount + 1} 个专业，超过最大限制 6 个`,
      );
      throw new BadRequestException('每个专业组下最多只能添加 6 个专业');
    }

    this.logger.log(
      `用户 ${userId} 创建志愿，mg_index: ${mgIndex}, major_index: ${majorIndex}`,
    );

    // 7. 创建志愿选择记录
    const choice = this.choiceRepository.create({
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
      remark: createChoiceDto.remark ?? null,
      tuitionFee: createChoiceDto.tuitionFee ?? null,
      curUnit: createChoiceDto.curUnit ?? null,
      majorIndex,
      majorScores: createChoiceDto.majorScores ?? null,
    });

    // 8. 保存到数据库
    const savedChoice = await this.choiceRepository.save(choice);

    this.logger.log(`用户 ${userId} 创建志愿选择成功，ID: ${savedChoice.id}`);

    // 9. 查询关联的专业组信息（如果存在）
    let majorGroup = null;
    if (savedChoice.mgId) {
      majorGroup = await this.majorGroupRepository.findOne({
        where: { mgId: savedChoice.mgId },
      });
    }

    // 10. 查询关联的学校信息（如果存在）
    let school = null;
    let schoolDetail = null;
    if (savedChoice.schoolCode) {
      school = await this.schoolRepository.findOne({
        where: { code: savedChoice.schoolCode },
      });
      if (school) {
        schoolDetail = await this.schoolDetailRepository.findOne({
          where: { code: savedChoice.schoolCode },
        });
      }
    }

    // 11. 构建响应对象，将 mgId 映射为 majorGroupId，并添加 majorGroup 和 school
    const responseData = {
      ...savedChoice,
      majorGroupId: savedChoice.mgId,
      majorGroup: majorGroup
        ? {
            schoolCode: majorGroup.schoolCode,
            province: majorGroup.province,
            year: majorGroup.year,
            subjectSelectionMode: majorGroup.subjectSelectionMode,
            batch: majorGroup.batch,
            mgId: majorGroup.mgId,
            mgName: majorGroup.mgName,
            mgInfo: majorGroup.mgInfo,
          }
        : null,
      majorScores: savedChoice.majorScores || [],
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

    // 12. 转换为响应 DTO
    return plainToInstance(ChoiceResponseDto, responseData, {
      excludeExtraneousValues: true,
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

    // 6. 查询用户的志愿选择列表（包含关联数据）
    const choices = await queryBuilder
      .orderBy('choice.createdAt', 'DESC') // 按创建时间倒序排列，最新的在前
      .getMany();

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
      majorScores: (choice.majorScores || []).map((score) => ({
        schoolCode: score.schoolCode,
        province: score.province,
        year: score.year,
        subjectSelectionMode: score.subjectSelectionMode,
        batch: score.batch,
        minScore: score.minScore,
        minRank: score.minRank,
        admitCount: score.admitCount,
        enrollmentType: score.enrollmentType,
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
          const majorGroups = Array.from(majorGroupsMap.entries())
            .sort(([mgIdA], [mgIdB]) => (mgIdA || 0) - (mgIdB || 0))
            .map(([mgId, groupChoices]) => {
              const firstChoiceInGroup = groupChoices[0];
              if (!firstChoiceInGroup.majorGroup) {
                return null;
              }
              // 按 majorIndex 排序
              groupChoices.sort((a, b) => (a.majorIndex || 0) - (b.majorIndex || 0));
              return {
                majorGroup: buildMajorGroupSimple(firstChoiceInGroup.majorGroup),
                choices: groupChoices.map(buildChoiceInGroup),
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
    // 1. 查找当前 mg_index 下的所有记录（在 userId, province, preferredSubjects, secondarySubjects, year 内）
    const currentChoicesQueryBuilder = this.choiceRepository
      .createQueryBuilder('choice')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.province = :province', { province })
      .andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects: preferredSubjects ?? null,
      })
      .andWhere('choice.year = :year', { year })
      .andWhere('choice.mgIndex = :mgIndex', { mgIndex });

    if (secondarySubjects && secondarySubjects.length > 0) {
      currentChoicesQueryBuilder.andWhere(
        'choice.secondarySubjects = :secondarySubjects',
        { secondarySubjects },
      );
    } else {
      currentChoicesQueryBuilder.andWhere(
        '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        { emptyArray: [] },
      );
    }

    const currentChoices = await currentChoicesQueryBuilder.getMany();

    if (currentChoices.length === 0) {
      throw new NotFoundException('未找到对应的志愿选择记录');
    }

    // 2. 根据方向，计算目标 mg_index
    const targetIndex = direction === 'up' ? -1 : 1;
    const targetMgIndex = mgIndex + targetIndex;

    if (targetMgIndex < 1) {
      throw new BadRequestException('已经是第一个，无法上移');
    }

    // 3. 查找目标 mg_index 下的所有记录（在 userId, province, preferredSubjects, secondarySubjects, year 内）
    // 按照索引顺序：userId, province, preferredSubjects, year
    const targetChoicesQueryBuilder = this.choiceRepository
      .createQueryBuilder('choice')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.province = :province', { province })
      .andWhere('choice.preferredSubjects = :preferredSubjects', {
        preferredSubjects: preferredSubjects ?? null,
      })
      .andWhere('choice.year = :year', { year })
      // 索引字段之后的其他条件
      .andWhere('choice.mgIndex = :targetMgIndex', { targetMgIndex });

    if (secondarySubjects && secondarySubjects.length > 0) {
      targetChoicesQueryBuilder.andWhere(
        'choice.secondarySubjects = :secondarySubjects',
        { secondarySubjects },
      );
    } else {
      targetChoicesQueryBuilder.andWhere(
        '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
        { emptyArray: [] },
      );
    }

    const targetChoices = await targetChoicesQueryBuilder.getMany();

    if (targetChoices.length === 0) {
      throw new BadRequestException(
        direction === 'up'
          ? '已经是第一个，无法上移'
          : '已经是最后一个，无法下移',
      );
    }

    // 4. 交换 mg_index：将当前 mg_index 的所有记录和目标 mg_index 的所有记录交换
    for (const choice of currentChoices) {
      choice.mgIndex = targetMgIndex;
    }

    for (const choice of targetChoices) {
      choice.mgIndex = mgIndex;
    }

    // 5. 保存所有记录
    await this.choiceRepository.save([...currentChoices, ...targetChoices]);

    this.logger.log(
      `用户 ${userId} 调整 mg_index，从 ${mgIndex} ${direction === 'up' ? '上移' : '下移'} 到 ${targetMgIndex}，更新了 ${currentChoices.length + targetChoices.length} 条记录`,
    );

    return { updated: currentChoices.length + targetChoices.length };
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
    // 1. 查找当前志愿选择记录，并验证是否属于当前用户
    const currentChoice = await this.choiceRepository.findOne({
      where: {
        id: choiceId,
        userId, // 确保只能调整自己的志愿
      },
    });

    if (!currentChoice) {
      this.logger.warn(
        `用户 ${userId} 尝试调整不存在的志愿选择或不属于自己的志愿，ID: ${choiceId}`,
      );
      throw new NotFoundException('志愿选择不存在或不属于当前用户');
    }

    // 2. 根据方向，查找相邻的记录
    const targetIndex = direction === 'up' ? -1 : 1;

    // 调整 major_index：需要在相同的 mg_index 下查找
    const targetMajorIndex = (currentChoice.majorIndex ?? 0) + targetIndex;

    if (targetMajorIndex < 1) {
      throw new BadRequestException('已经是第一个，无法上移');
    }

    const targetChoice = await this.choiceRepository.findOne({
      where: {
        userId,
        mgIndex: currentChoice.mgIndex,
        majorIndex: targetMajorIndex,
      },
    });

    if (!targetChoice) {
      throw new BadRequestException(
        direction === 'up'
          ? '已经是第一个，无法上移'
          : '已经是最后一个，无法下移',
      );
    }

    // 3. 交换 major_index
    const tempMajorIndex = currentChoice.majorIndex;
    currentChoice.majorIndex = targetChoice.majorIndex;
    targetChoice.majorIndex = tempMajorIndex;

    // 4. 保存两条记录
    await this.choiceRepository.save([currentChoice, targetChoice]);

    this.logger.log(
      `用户 ${userId} 调整志愿选择 major_index，ID: ${choiceId}，方向: ${direction}`,
    );

    // 5. 返回更新后的记录（调用通用方法）
    return await this.getChoiceResponseDto(choiceId);
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
            mgId: majorGroup.mgId,
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
