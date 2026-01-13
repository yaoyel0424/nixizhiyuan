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
    const enrollmentType = user.enrollType || null;
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
    // 规则：同一用户、同一省份、同一学校、同一批次下、同一专业组，其 mg_index 应该是一致的
    // 查询是否存在相同的 user_id, province, school_code, batch, mg_id 组合
    const sameGroupChoice = await this.choiceRepository.findOne({
      where: {
        userId,
        province,
        schoolCode: createChoiceDto.schoolCode ?? null,
        batch: createChoiceDto.batch ?? null,
        mgId: createChoiceDto.mgId ?? null,
      },
      order: {
        mgIndex: 'ASC', // 获取第一个记录，用于获取 mg_index
      },
    });

    let mgIndex: number;
    if (sameGroupChoice && sameGroupChoice.mgIndex !== null) {
      // 如果存在相同组合，使用已存在的 mg_index
      mgIndex = sameGroupChoice.mgIndex;
      this.logger.log(
        `用户 ${userId} 在相同专业组下创建志愿，复用 mg_index: ${mgIndex}`,
      );
    } else {
      // 如果不存在，计算该组合（userId, province, schoolCode, batch）下的最大 mg_index
      const maxMgIndexResult = await this.choiceRepository
        .createQueryBuilder('choice')
        .select('MAX(choice.mgIndex)', 'max')
        .where('choice.userId = :userId', { userId })
        .andWhere('choice.province = :province', { province })
        .andWhere('choice.schoolCode = :schoolCode', {
          schoolCode: createChoiceDto.schoolCode ?? null,
        })
        .andWhere('choice.batch = :batch', {
          batch: createChoiceDto.batch ?? null,
        })
        .getRawOne();

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
    const maxMajorIndexResult = await this.choiceRepository
      .createQueryBuilder('choice')
      .select('MAX(choice.majorIndex)', 'max')
      .where('choice.userId = :userId', { userId })
      .andWhere('choice.mgIndex = :mgIndex', { mgIndex })
      .getRawOne();

    const maxMajorIndex = maxMajorIndexResult?.max
      ? parseInt(maxMajorIndexResult.max, 10)
      : 0;
    const majorIndex = maxMajorIndex + 1;

    // 6.1 检查该 mg_index 下是否已经有 6 个专业
    const existingChoicesCount = await this.choiceRepository.count({
      where: {
        userId,
        mgIndex,
      },
    });

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

    // 3. 查询用户的志愿选择列表
    const choices = await this.choiceRepository.find({
      where: {
        userId,
        year: queryYear,
      },
      order: {
        createdAt: 'DESC', // 按创建时间倒序排列，最新的在前
      },
    });

    if (choices.length === 0) {
      this.logger.log(`用户 ${userId} 在 ${queryYear} 年没有志愿选择记录`);
      // 返回空数据，但包含统计信息
      const provinceCode = user.province ? PROVINCE_NAME_TO_CODE[user.province] : null;
      const totalCount = provinceCode ? (PROVINCE_CODE_TO_VOLUNTEER_COUNT[provinceCode] || 0) : 0;
      const emptyData = [] as any;
      emptyData.statistics = {
        selected: 0,
        total: totalCount,
      };
      return emptyData as GroupedChoiceResponseDto;
    }

    // 4. 查询所有关联的专业组信息
    const mgIds = choices
      .map((c) => c.mgId)
      .filter((id): id is number => id !== null && id !== undefined);

    const majorGroupsMap = new Map<number, MajorGroup>();
    if (mgIds.length > 0) {
      const majorGroups = await this.majorGroupRepository.find({
        where: { mgId: In(mgIds) },
      });
      majorGroups.forEach((mg) => {
        if (mg.mgId !== null) {
          majorGroupsMap.set(mg.mgId, mg);
        }
      });
    }

    // 5. 查询所有关联的学校信息
    const schoolCodes = choices
      .map((c) => c.schoolCode)
      .filter((code): code is string => code !== null && code !== undefined);

    const schoolsMap = new Map<string, School>();
    const schoolDetailsMap = new Map<string, SchoolDetail>();
    if (schoolCodes.length > 0) {
      const schools = await this.schoolRepository.find({
        where: { code: In(schoolCodes) },
      });
      schools.forEach((school) => {
        schoolsMap.set(school.code, school);
      });

      const schoolDetails = await this.schoolDetailRepository.find({
        where: { code: In(schoolCodes) },
      });
      schoolDetails.forEach((detail) => {
        schoolDetailsMap.set(detail.code, detail);
      });
    }

    // 6. 构建响应数据
    const responseDataList = choices.map((choice) => {
      const majorGroup = choice.mgId ? majorGroupsMap.get(choice.mgId) || null : null;
      const school = choice.schoolCode ? schoolsMap.get(choice.schoolCode) || null : null;
      const schoolDetail = choice.schoolCode
        ? schoolDetailsMap.get(choice.schoolCode) || null
        : null;

      return {
        ...choice,
        userId: choice.userId,
        majorGroupId: choice.mgId,
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
        majorScores: choice.majorScores || [],
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
    });

    // 7. 转换为响应 DTO 列表
    const choiceResponseList = plainToInstance(ChoiceResponseDto, responseDataList, {
      excludeExtraneousValues: true,
    });

    // 8. 对结果进行分组：按照 mgIndex 分组
    const grouped: SchoolGroupDto[] = [];

    // 8.1 分离有 majorGroup 和没有 majorGroup 的数据
    const withMajorGroup = choiceResponseList.filter((choice) => choice.majorGroup !== null);
    const withoutMajorGroup = choiceResponseList.filter((choice) => choice.majorGroup === null);

    // 8.2 对有 majorGroup 的数据，按照 mgIndex 进行分组
    // 使用 mgIndex 作为分组依据
    const mgIndexGroupsMap = new Map<number, ChoiceResponseDto[]>();

    for (const choice of withMajorGroup) {
      if (!choice.majorGroup || choice.mgIndex === null || choice.mgIndex === undefined) {
        continue;
      }

      const mgIndex = choice.mgIndex;

      if (!mgIndexGroupsMap.has(mgIndex)) {
        mgIndexGroupsMap.set(mgIndex, []);
      }

      mgIndexGroupsMap.get(mgIndex)!.push(choice);
    }

    // 8.3 构建分组结构（按 mgIndex）
    for (const [mgIndex, choices] of mgIndexGroupsMap.entries()) {
      if (choices.length === 0) {
        continue;
      }

      // 从第一个 choice 中获取 schoolCode 和 school 信息
      const firstChoice = choices[0];
      const schoolCode = firstChoice.schoolCode;

      if (!schoolCode) {
        continue;
      }

      // 从 schoolsMap 中获取 school 信息
      const school = schoolsMap.get(schoolCode);
      const schoolDetail = schoolDetailsMap.get(schoolCode);

      if (!school) {
        continue;
      }

      // 构建 school 对象
      const schoolDto: SchoolSimpleDto = {
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
      };

      // 按 majorGroupId 对 choices 进行二级分组
      // 注意：同一个 mgIndex 下的 choices 应该有相同的 majorGroupId，但为了兼容性，仍然按 majorGroupId 分组
      const majorGroupsMap = new Map<number | null, ChoiceResponseDto[]>();
      for (const choice of choices) {
        // 使用 majorGroupId 进行分组（这是已编码的值，但同一个专业组的 majorGroupId 应该相同）
        const majorGroupId = choice.majorGroupId;
        if (majorGroupId === null || majorGroupId === undefined) {
          this.logger.warn(
            `mgIndex ${mgIndex} 下的 choice ${choice.id} 的 majorGroupId 为空`,
          );
          continue;
        }
        if (!majorGroupsMap.has(majorGroupId)) {
          majorGroupsMap.set(majorGroupId, []);
        }
        majorGroupsMap.get(majorGroupId)!.push(choice);
      }

      this.logger.debug(
        `mgIndex ${mgIndex} 下的 choices 数量: ${choices.length}, majorGroupsMap 大小: ${majorGroupsMap.size}`,
      );

      const majorGroups: MajorGroupGroupDto[] = [];
      for (const [majorGroupId, mgChoices] of majorGroupsMap.entries()) {
        if (mgChoices.length === 0) {
          continue;
        }
        
        const firstChoiceInGroup = mgChoices[0];
        // 由于 withMajorGroup 已经过滤了 majorGroup !== null 的数据，这里应该总是有 majorGroup
        if (!firstChoiceInGroup) {
          continue;
        }

        // 检查 majorGroup 是否存在
        if (!firstChoiceInGroup.majorGroup) {
          this.logger.warn(
            `mgIndex ${mgIndex}, majorGroupId ${majorGroupId} 下的 choice ${firstChoiceInGroup.id} 没有 majorGroup，但 majorGroupId 为 ${firstChoiceInGroup.majorGroupId}`,
          );
          continue;
        }

        this.logger.debug(
          `mgIndex ${mgIndex}, majorGroupId ${majorGroupId} 下的 choices 数量: ${mgChoices.length}`,
        );

        // 对 choices 按照 majorIndex 排序
        mgChoices.sort((a, b) => {
          return (a.majorIndex || 0) - (b.majorIndex || 0);
        });

        // 移除 choices 中的 school 和 majorGroup 信息
        const choicesInGroup = mgChoices.map((choice) => {
          const { school, majorGroup, ...choiceWithoutGroup } = choice;
          return choiceWithoutGroup;
        });

        // 转换为 ChoiceInGroupDto
        const choicesInGroupDto = plainToInstance(ChoiceInGroupDto, choicesInGroup, {
          excludeExtraneousValues: true,
        });

        majorGroups.push({
          majorGroup: firstChoiceInGroup.majorGroup,
          choices: choicesInGroupDto,
        });
      }

      // 对 majorGroups 按照 majorGroupId 排序（使用第一个 choice 的 majorGroupId）
      majorGroups.sort((a, b) => {
        // 由于 mgId 可能被 @Exclude 排除，我们无法直接访问
        // 但我们可以通过比较 majorGroup 的其他字段来排序，或者使用 mgChoices 中的 majorGroupId
        // 为了简单，我们按照第一个 choice 的 majorGroupId 排序
        const mgIdA = a.majorGroup?.mgId || 0;
        const mgIdB = b.majorGroup?.mgId || 0;
        return mgIdA - mgIdB;
      });

      grouped.push({
        mgIndex, // 添加 mgIndex
        school: schoolDto,
        majorGroups,
      });
    }

    // 8.4 处理没有 majorGroup 的数据，按 mgIndex 分组
    const ungroupedMgIndexMap = new Map<number, ChoiceResponseDto[]>();
    for (const choice of withoutMajorGroup) {
      if (choice.mgIndex === null || choice.mgIndex === undefined) {
        continue;
      }
      const mgIndex = choice.mgIndex;
      if (!ungroupedMgIndexMap.has(mgIndex)) {
        ungroupedMgIndexMap.set(mgIndex, []);
      }
      ungroupedMgIndexMap.get(mgIndex)!.push(choice);
    }

    // 为没有 majorGroup 的数据创建分组
    for (const [mgIndex, choices] of ungroupedMgIndexMap.entries()) {
      if (choices.length === 0) {
        continue;
      }

      const firstChoice = choices[0];
      const schoolCode = firstChoice.schoolCode;

      if (!schoolCode) {
        continue;
      }

      const school = schoolsMap.get(schoolCode);
      const schoolDetail = schoolDetailsMap.get(schoolCode);

      if (!school) {
        continue;
      }

      const schoolDto: SchoolSimpleDto = {
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
      };

      // 移除 choices 中的 school 和 majorGroup 信息
      const choicesInGroup = choices.map((choice) => {
        const { school, majorGroup, ...choiceWithoutGroup } = choice;
        return choiceWithoutGroup;
      });

      const choicesInGroupDto = plainToInstance(ChoiceInGroupDto, choicesInGroup, {
        excludeExtraneousValues: true,
      });

      grouped.push({
        mgIndex, // 添加 mgIndex
        school: schoolDto,
        majorGroups: [
          {
            majorGroup: null as any, // 没有 majorGroup，但为了结构一致，设置为 null
            choices: choicesInGroupDto,
          },
        ],
      });
    }

    // 7.5 对 grouped 按照 mgIndex 排序
    grouped.sort((a, b) => {
      const mgIndexA = a.mgIndex || 0;
      const mgIndexB = b.mgIndex || 0;
      return mgIndexA - mgIndexB;
    });

    // 8. 计算统计信息
    // 8.1 获取已选择的志愿数量（根据 mgIndex 的唯一数量）
    const uniqueMgIndexes = new Set<number>();
    for (const choice of choices) {
      if (choice.mgIndex !== null && choice.mgIndex !== undefined) {
        uniqueMgIndexes.add(choice.mgIndex);
      }
    }
    const selectedCount = uniqueMgIndexes.size;

    // 9.2 根据用户省份获取最大志愿数量
    const provinceCode = user.province ? PROVINCE_NAME_TO_CODE[user.province] : null;
    const totalCount = provinceCode ? (PROVINCE_CODE_TO_VOLUNTEER_COUNT[provinceCode] || 0) : 0;

    // 10. 构建响应对象
    const statistics: VolunteerStatisticsDto = {
      selected: selectedCount,
      total: totalCount,
    };

    // 11. 转换分组数据
    const groupedData = plainToInstance(SchoolGroupDto, grouped, {
      excludeExtraneousValues: true,
    });

    // 12. 将统计信息作为扩展属性添加到数组上
    (groupedData as any).statistics = statistics;

    // 13. 返回分组后的数据（包含统计信息）
    return groupedData as GroupedChoiceResponseDto;
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
   * @param province 省份
   * @param batch 批次
   * @param direction 调整方向：up（上移）或 down（下移）
   * @returns 更新后的记录数量
   */
  async adjustMgIndex(
    userId: number,
    mgIndex: number,
    province: string,
    batch: string,
    direction: 'up' | 'down',
  ): Promise<{ updated: number }> {
    // 1. 查找当前 mg_index 下的所有记录（在 province 和 batch 内）
    const currentChoices = await this.choiceRepository.find({
      where: {
        userId,
        province,
        batch,
        mgIndex,
      },
    });

    if (currentChoices.length === 0) {
      throw new NotFoundException('未找到对应的志愿选择记录');
    }

    // 2. 根据方向，计算目标 mg_index
    const targetIndex = direction === 'up' ? -1 : 1;
    const targetMgIndex = mgIndex + targetIndex;

    if (targetMgIndex < 1) {
      throw new BadRequestException('已经是第一个，无法上移');
    }

    // 3. 查找目标 mg_index 下的所有记录（在 province 和 batch 内）
    const targetChoices = await this.choiceRepository.find({
      where: {
        userId,
        province,
        batch,
        mgIndex: targetMgIndex,
      },
    });

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
   * 1. mgIndex：按照 userId, province, schoolCode, batch 分组，在每组内按照 mgId 分配递增的 mgIndex（同一 mgId 使用相同的 mgIndex）
   * 2. majorIndex：在同一个 mgIndex 下，按照创建时间递增分配 majorIndex
   * @returns 修复的记录数量
   */
  async fixAllIndexes(): Promise<{ fixed: number }> {
    this.logger.log('开始修复所有记录的 mgIndex 和 majorIndex');

    // 1. 查询所有记录，按 userId, province, schoolCode, batch 分组
    const allChoices = await this.choiceRepository.find({
      order: {
        userId: 'ASC',
        province: 'ASC',
        schoolCode: 'ASC',
        batch: 'ASC',
        createdAt: 'ASC', // 按创建时间排序，确保顺序一致
      },
    });

    if (allChoices.length === 0) {
      this.logger.log('没有需要修复的记录');
      return { fixed: 0 };
    }

    // 2. 按 userId, province, schoolCode, batch 分组
    const groupedByUserProvinceSchoolBatch = new Map<string, Choice[]>();
    for (const choice of allChoices) {
      const key = `${choice.userId}_${choice.province}_${choice.schoolCode || 'null'}_${choice.batch || 'null'}`;
      if (!groupedByUserProvinceSchoolBatch.has(key)) {
        groupedByUserProvinceSchoolBatch.set(key, []);
      }
      groupedByUserProvinceSchoolBatch.get(key)!.push(choice);
    }

    let fixedCount = 0;

    // 3. 对每个分组进行处理
    for (const [key, choices] of groupedByUserProvinceSchoolBatch.entries()) {
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
