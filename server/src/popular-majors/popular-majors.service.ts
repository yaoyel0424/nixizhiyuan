import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';
import { ErrorCode } from '../common/constants/error-code.constant';

/**
 * 热门专业服务
 * 处理热门专业相关的业务逻辑
 */
@Injectable()
export class PopularMajorsService {
  constructor(
    @InjectRepository(PopularMajor)
    private readonly popularMajorRepository: Repository<PopularMajor>,
  ) {}

  /**
   * 分页查询热门专业列表
   * @param queryDto 查询条件
   * @returns 分页结果
   */
  async findAll(queryDto: QueryPopularMajorDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = 'ASC',
      level1,
      name,
      code,
    } = queryDto;

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (level1) {
      where.level1 = level1;
    }

    if (name) {
      where.name = Like(`%${name}%`);
    }

    if (code) {
      where.code = code;
    }

    // 执行查询
    const [items, total] = await this.popularMajorRepository.findAndCount({
      where,
      relations: ['majorDetail'],
      order: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * 根据 ID 获取热门专业详情
   * @param id 热门专业 ID
   * @returns 热门专业详情
   */
  async findOne(id: number): Promise<PopularMajor> {
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { id },
      relations: ['majorDetail', 'majorDetail.major'],
    });

    if (!popularMajor) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '热门专业不存在',
      });
    }

    return popularMajor;
  }

  /**
   * 根据专业代码获取热门专业详情
   * @param code 专业代码
   * @returns 热门专业详情
   */
  async findByCode(code: string): Promise<PopularMajor | null> {
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { code },
      relations: ['majorDetail'],
    });

    if (!popularMajor) {
      return null;
    }

    return popularMajor;
  }

  /**
   * 根据教育层次获取热门专业列表
   * @param level1 教育层次
   * @returns 热门专业列表
   */
  async findByLevel1(level1: string): Promise<PopularMajor[]> {
    const popularMajors = await this.popularMajorRepository.find({
      where: { level1 },
      relations: ['majorDetail'],
      order: {
        id: 'ASC',
      },
    });

    return popularMajors;
  }
}

