import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ArrayOverlap } from 'typeorm';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';

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
  ) {}

  /**
   * 根据用户信息查询匹配的招生计划
   * @param userId 用户ID
   * @param year 年份，默认为2025
   * @returns 匹配的招生计划列表（包含学校和学校详情信息）
   */
  async findEnrollmentPlansByUser(
    userId: number,
    year: string = '2025',
  ): Promise<Array<EnrollmentPlan & { school: School | null; schoolDetail: SchoolDetail | null }>> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 2. 获取用户收藏的专业
    const majorFavorites = await this.majorFavoriteRepository.find({
      where: { userId },
      relations: ['major'],
    });

    if (majorFavorites.length === 0) {
      this.logger.log(`用户 ${userId} 没有收藏的专业`);
      return [];
    }

    // 3. 获取所有收藏专业的ID（level 3 专业）
    const majorCodes = majorFavorites.map((mf) => mf.majorCode);
    const majors = await this.majorRepository.find({
      where: {
        code: In(majorCodes),
        level: 3, // 只查询三级专业
      },
    });

    if (majors.length === 0) {
      this.logger.log(`用户 ${userId} 收藏的专业中没有找到三级专业`);
      return [];
    }

    const majorIds = majors.map((m) => m.id);

    // 4. 构建查询条件
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

    // 5. 执行查询
    const enrollmentPlans = await queryBuilder.getMany();

    if (enrollmentPlans.length === 0) {
      this.logger.log(
        `用户 ${userId} 没有找到匹配的招生计划，省份: ${user.province}, 批次: ${user.enrollType}, 首选: ${user.preferredSubjects}`,
      );
      return [];
    }

    // 6. 获取所有学校的代码
    const schoolCodes = enrollmentPlans
      .map((ep) => ep.schoolCode)
      .filter((code) => code)
      .filter((code, index, self) => self.indexOf(code) === index); // 去重

    // 7. 批量查询学校详情
    const schoolDetails = await this.schoolDetailRepository.find({
      where: {
        code: In(schoolCodes),
      },
    });

    // 8. 创建学校代码到学校详情的映射
    const schoolDetailMap = new Map<string, SchoolDetail>();
    schoolDetails.forEach((sd) => {
      if (sd.code) {
        schoolDetailMap.set(sd.code, sd);
      }
    });

    // 9. 为每个招生计划添加学校详情
    const result = enrollmentPlans.map((ep) => ({
      ...ep,
      schoolDetail: ep.schoolCode
        ? schoolDetailMap.get(ep.schoolCode) || null
        : null,
    }));

    this.logger.log(
      `用户 ${userId} 找到 ${result.length} 个匹配的招生计划`,
    );

    return result;
  }
}

