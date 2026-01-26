import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities/user.entity';
import { ProvincialControlLine } from '@/entities/provincial-control-line.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Alternative } from '@/entities/alternative.entity';
import { Choice } from '@/entities/choices.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './repositories/users.repository';
import { ErrorCode } from '../common/constants/error-code.constant';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { UserRelatedDataResponseDto } from './dto/user-related-data-response.dto';
import { ContentSecurityService } from '@/common/services/content-security.service';

/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProvincialControlLine)
    private readonly provincialControlLineRepository: Repository<ProvincialControlLine>,
    @InjectRepository(ScaleAnswer)
    private readonly scaleAnswerRepository: Repository<ScaleAnswer>,
    @InjectRepository(MajorFavorite)
    private readonly majorFavoriteRepository: Repository<MajorFavorite>,
    @InjectRepository(ProvinceFavorite)
    private readonly provinceFavoriteRepository: Repository<ProvinceFavorite>,
    @InjectRepository(Alternative)
    private readonly alternativeRepository: Repository<Alternative>,
    @InjectRepository(Choice)
    private readonly choiceRepository: Repository<Choice>,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly contentSecurityService: ContentSecurityService,
  ) {}

  /**
   * 创建用户
   * 通过 openid、nickname、avatarUrl、unionid 创建，其他字段默认为 null
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // 检查 openid 是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { openid: createUserDto.openid },
    });
    if (existingUser) {
      throw new ConflictException({
        code: ErrorCode.USER_ALREADY_EXISTS,
        message: '该微信账号已注册',
      });
    }

    // 创建用户，其他字段默认为 null
    const user = this.userRepository.create({
      openid: createUserDto.openid,
      nickname: createUserDto.nickname || null,
      avatarUrl: createUserDto.avatarUrl || null,
      unionid: createUserDto.unionid || null,
      // 其他字段默认为 null
      province: null,
      score: null,
      preferredSubjects: null,
      secondarySubjects: null,
      rank: null,
      enrollType: null,
      userType: 'child', // 默认值
      age: null,
      gender: null,
    });

    return await this.userRepository.save(user);
  }
 

  /**
   * 根据 ID 查找用户
   */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.USER_NOT_FOUND,
        message: '用户不存在',
      });
    }
    return user;
  }

  /**
   * 更新用户
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * 删除用户（软删除）
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
  }
 
  /**
   * 根据 openid 查找用户（用于微信登录）
   */
  async findByOpenid(openid: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { openid } });
  }

  /**
   * 根据分数、省份、年份和类型名称获取录取类型
   * @param userScore 用户分数
   * @param province 省份名称
   * @param year 年份
   * @param typeName 类型名称（首选科目）
   * @returns 录取类型（本科批/专科批/未达到录取线）
   */
  async getEnrollTypeByScore(
    userScore: number,
    province: string,
    year: string,
    typeName: string,
  ): Promise<string> {
    try {
      this.logger.log(
        `尝试查询录取类型，userScore: ${userScore}, province: ${province}, year: ${year}, typeName: ${typeName}`,
        'UsersService',
      );

      const results = await this.provincialControlLineRepository
        .createQueryBuilder('pcl')
        .select(['pcl.batchName', 'pcl.score'])
        .where('pcl.province = :province', { province })
        .andWhere('pcl.year = :year', { year })
        .andWhere('pcl.typeName = :typeName', { typeName })
        .andWhere('pcl.convention_batch=:conventionBatch', { conventionBatch: true })
        .orderBy('pcl.score', 'DESC')
        .getRawMany();

      if (!results || results.length === 0) {
        this.logger.warn(
          `未找到省份控制线数据，province: ${province}, year: ${year}, typeName: ${typeName}`,
          'UsersService',
        );
        return '未达到录取线';
      }

      console.log(results);
      
      // 找到用户分数能够达到的最高批次（按分数降序排列，找到第一个用户分数 >= 批次分数）
      let enrollType: string = '未达到录取线';
      for (const item of results) {
        const batchScore = parseInt(item.pcl_score) || 0; 
        if (userScore >= batchScore) {
          enrollType = item.pcl_batch_name || '未达到录取线';
          break;
        }
      }

      this.logger.log(
        `查询录取类型成功，userScore: ${userScore}, enrollType: ${enrollType}, 批次数据条数: ${results.length}`,
        'UsersService',
      );
      return enrollType;
    } catch (error) {
      this.logger.error(
        `查询录取类型失败，userScore: ${userScore}, province: ${province}, year: ${year}, typeName: ${typeName}`,
        error instanceof Error ? error.stack : String(error),
        'UsersService',
      );
      throw error;
    }
  }

  /**
   * 更新用户选科和分数信息
   * @param id 用户ID
   * @param updateData 更新数据
   * @returns 更新后的用户信息
   */
  async updateProfile(
    id: number,
    updateData: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findOne(id);

    // 如果提供了分数和省份信息，查询录取类型
    if (updateData.score !== undefined && updateData.province) {
      const year =
        this.configService.get<string>('CURRENT_YEAR') || '2025';
      const typeName = updateData.preferredSubjects || '综合';
      const enrollType = await this.getEnrollTypeByScore(
        updateData.score,
        updateData.province,
        year,
        typeName,
      );
      updateData.enrollType = enrollType;
    }

     //if (updateData.preferredSubjects=="物理"){
     //updateData.preferredSubjects="物理类"
     //}  else if (updateData.preferredSubjects=="历史"){
     //  updateData.preferredSubjects="历史类"
     //} 
    // 更新用户信息
    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  /**
   * 更新用户昵称
   * @param id 用户ID
   * @param nickname 用户昵称
   * @returns 更新后的用户信息
   */
  async updateNickname(id: number, nickname: string): Promise<User> {
    // 内容安全检查
    await this.contentSecurityService.checkTextSecurity(nickname);

    const user = await this.findOne(id);
    user.nickname = nickname;
    return this.userRepository.save(user);
  }

  /**
   * 获取用户相关数据的数量统计（优化版本）
   * 使用 COUNT 查询替代加载所有数据，并将多个 COUNT 合并为一条 SQL 查询
   * @param userId 用户ID
   * @returns 用户相关数据的数量统计
   */
  async getUserRelatedDataCount(
    userId: number,
  ): Promise<UserRelatedDataResponseDto> {
    // 1. 只查询用户基本信息（不需要关联数据，只选择需要的字段）
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'province', 'preferredSubjects', 'secondarySubjects', 'enrollType'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 使用一条 SQL 查询同时获取三个 COUNT 统计和省份数组
    // 使用子查询将 scaleAnswers、majorFavorites、provinceFavorites 的统计合并
    // 使用 json_agg 聚合省份信息为 JSON 数组
    const countsResult = await this.userRepository
      .createQueryBuilder('user')
      .select(
        `(SELECT COUNT(DISTINCT sa.scale_id) 
          FROM scale_answers sa 
          WHERE sa.user_id = :userId AND sa.scale_id > 112)`,
        'scaleAnswersCount',
      )
      .addSelect(
        `(SELECT COUNT(*) 
          FROM major_favorites mf 
          WHERE mf.user_id = :userId)`,
        'majorFavoritesCount',
      )
      .addSelect(
        `(SELECT COUNT(*) 
          FROM province_favorites pf 
          WHERE pf.user_id = :userId)`,
        'provinceFavoritesCount',
      )
      .addSelect(
        `(SELECT COALESCE(json_agg(p.name ORDER BY pf.created_at DESC), '[]'::json)
          FROM province_favorites pf
          INNER JOIN provinces p ON p.id = pf.province_id
          WHERE pf.user_id = :userId)`,
        'provinceFavorites',
      )
      .where('user.id = :userId', { userId })
      .getRawOne();

    const scaleAnswersCount = parseInt(
      countsResult?.scaleAnswersCount || '0',
      10,
    );
    const majorFavoritesCount = parseInt(
      countsResult?.majorFavoritesCount || '0',
      10,
    );
    const provinceFavoritesCount = parseInt(
      countsResult?.provinceFavoritesCount || '0',
      10,
    );

    // 3. 解析省份名称数组 JSON（如果查询结果为空，返回空数组）
    let provinceFavoritesList: string[] = [];
    try {
      const provinceFavoritesJson = countsResult?.provinceFavorites;
      if (provinceFavoritesJson) {
        provinceFavoritesList = Array.isArray(provinceFavoritesJson)
          ? provinceFavoritesJson
          : JSON.parse(provinceFavoritesJson);
      }
    } catch (error) {
      this.logger.warn(
        `解析省份收藏数组失败，userId: ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      provinceFavoritesList = [];
    }

    // 4. 查询 choices 数量（暂时注释掉，直接返回 0）
    // 根据 user 的 id, province, preferredSubjects, secondarySubjects, enrollType (对应 batch), year 查询 mgIndex 的数量
    // const year = this.configService.get<string>('CURRENT_YEAR') || '2025';
    // const province = user.province || null;
    // const preferredSubjects = user.preferredSubjects || null;
    // const secondarySubjects = user.secondarySubjects
    //   ? user.secondarySubjects.split(',').map((s) => s.trim()).filter((s) => s)
    //   : null;
    // const batch = user.enrollType || null;

    // 查询符合条件的 choices，统计不重复的 mgIndex 数量
    // 按照索引顺序：userId, province, preferredSubjects, year
    let choicesCount = 0;
    // if (province && preferredSubjects) {
    //   const choicesQueryBuilder = this.choiceRepository
    //     .createQueryBuilder('choice')
    //     .select('DISTINCT choice.mgIndex', 'mgIndex')
    //     .where('choice.userId = :userId', { userId })
    //     .andWhere('choice.province = :province', { province })
    //     .andWhere('choice.preferredSubjects = :preferredSubjects', {
    //       preferredSubjects,
    //     })
    //     .andWhere('choice.year = :year', { year })
    //     .andWhere('choice.mgIndex IS NOT NULL');

    //   if (batch) {
    //     choicesQueryBuilder.andWhere('choice.batch = :batch', { batch });
    //   }

    //   if (secondarySubjects && secondarySubjects.length > 0) {
    //     choicesQueryBuilder.andWhere(
    //       'choice.secondarySubjects = :secondarySubjects',
    //       { secondarySubjects },
    //     );
    //   } else {
    //     choicesQueryBuilder.andWhere(
    //       '(choice.secondarySubjects IS NULL OR choice.secondarySubjects = :emptyArray)',
    //       { emptyArray: [] },
    //     );
    //   }

    //   const distinctMgIndexes = await choicesQueryBuilder.getRawMany();
    //   choicesCount = distinctMgIndexes.length;
    // }

    this.logger.log(
      `用户 ${userId} 相关数据统计：scaleAnswers=${scaleAnswersCount}, majorFavorites=${majorFavoritesCount}, provinceFavorites=${provinceFavoritesCount}, choices=${choicesCount}`,
    );

    return plainToInstance(
      UserRelatedDataResponseDto,
      {
        scaleAnswersCount,
        majorFavoritesCount,
        provinceFavoritesCount,
        choicesCount,
        preferredSubjects: user.preferredSubjects || null,
        provinceFavorites: provinceFavoritesList,
        province: user.province || null,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }
}

