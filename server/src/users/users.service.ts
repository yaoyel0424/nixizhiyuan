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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './repositories/users.repository';
import { ErrorCode } from '../common/constants/error-code.constant';
import { ConfigService } from '@nestjs/config';

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
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
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

      const result = await this.provincialControlLineRepository
        .createQueryBuilder('pcl')
        .select([
          'MAX(CASE WHEN pcl.batchName LIKE :undergraduatePattern THEN pcl.score END) AS undergraduate_score',
          'MAX(CASE WHEN pcl.batchName LIKE :collegePattern THEN pcl.score END) AS college_score',
        ])
        .where('pcl.province = :province', { province })
        .andWhere('pcl.year = :year', { year })
        .andWhere('pcl.typeName = :typeName', { typeName })
        .setParameter('undergraduatePattern', '%本科%')
        .setParameter('collegePattern', '%专科%')
        .getRawOne();

      if (!result) {
        this.logger.warn(
          `未找到省份控制线数据，province: ${province}, year: ${year}, typeName: ${typeName}`,
          'UsersService',
        );
        return '未达到录取线';
      }

      const undergraduateScore = parseInt(result.undergraduate_score) || 0;
      const collegeScore = parseInt(result.college_score) || 0;

      let enrollType: string;
      if (userScore >= undergraduateScore) {
        enrollType = '本科批';
      } else if (userScore >= collegeScore) {
        enrollType = '专科批';
      } else {
        enrollType = '未达到录取线';
      }

      this.logger.log(
        `查询录取类型成功，userScore: ${userScore}, undergraduateScore: ${undergraduateScore}, collegeScore: ${collegeScore}, enrollType: ${enrollType}`,
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

    if (updateData.preferredSubjects=="物理"){
      updateData.preferredSubjects="物理类"
    }  else if (updateData.preferredSubjects=="历史"){
      updateData.preferredSubjects="历史类"
    } 
    // 更新用户信息
    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }
}

