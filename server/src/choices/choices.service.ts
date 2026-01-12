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
      // 如果不存在，计算该组合下的最大 mg_index
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
   * 获取用户的志愿选择列表
   * @param userId 用户ID
   * @param year 年份，如果不传则从配置中读取
   * @returns 志愿选择列表
   */
  async findByUser(
    userId: number,
    year?: string,
  ): Promise<ChoiceResponseDto[]> {
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
      return [];
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

    // 6. 转换为响应 DTO 列表
    return plainToInstance(ChoiceResponseDto, responseDataList, {
      excludeExtraneousValues: true,
    });
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
  async adjustIndex(
    userId: number,
    choiceId: number,
    indexType: 'mg_index' | 'major_index',
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

    // 2. 根据调整类型和方向，查找相邻的记录
    let targetChoice: Choice | null = null;
    const targetIndex = direction === 'up' ? -1 : 1;

    if (indexType === 'mg_index') {
      // 调整 mg_index：需要在相同的 user_id, province, school_code, batch 下查找
      const targetMgIndex =
        (currentChoice.mgIndex ?? 0) + targetIndex;

      if (targetMgIndex < 1) {
        throw new BadRequestException('已经是第一个，无法上移');
      }

      targetChoice = await this.choiceRepository.findOne({
        where: {
          userId,
          province: currentChoice.province,
          schoolCode: currentChoice.schoolCode,
          batch: currentChoice.batch,
          mgIndex: targetMgIndex,
        },
      });

      if (!targetChoice) {
        throw new BadRequestException(
          direction === 'up'
            ? '已经是第一个，无法上移'
            : '已经是最后一个，无法下移',
        );
      }

      // 3. 交换 mg_index
      const tempMgIndex = currentChoice.mgIndex;
      currentChoice.mgIndex = targetChoice.mgIndex;
      targetChoice.mgIndex = tempMgIndex;

      // 4. 保存两条记录
      await this.choiceRepository.save([currentChoice, targetChoice]);

      this.logger.log(
        `用户 ${userId} 调整志愿选择 mg_index，ID: ${choiceId}，方向: ${direction}`,
      );
    } else {
      // 调整 major_index：需要在相同的 mg_index 下查找
      const targetMajorIndex =
        (currentChoice.majorIndex ?? 0) + targetIndex;

      if (targetMajorIndex < 1) {
        throw new BadRequestException('已经是第一个，无法上移');
      }

      targetChoice = await this.choiceRepository.findOne({
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
    }

    // 5. 重新查询当前记录（包含关联数据）
    const updatedChoice = await this.choiceRepository.findOne({
      where: { id: choiceId },
      relations: ['majorGroup'],
    });

    if (!updatedChoice) {
      throw new NotFoundException('更新后的记录不存在');
    }

    // 6. 查询关联的专业组信息
    let majorGroup = null;
    if (updatedChoice.mgId) {
      majorGroup = await this.majorGroupRepository.findOne({
        where: { mgId: updatedChoice.mgId },
      });
    }

    // 7. 查询关联的学校信息
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

    // 8. 构建响应对象
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

    // 9. 转换为响应 DTO
    return plainToInstance(ChoiceResponseDto, responseData, {
      excludeExtraneousValues: true,
    });
  }
}
