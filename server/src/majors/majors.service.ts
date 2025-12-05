import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { CreateMajorFavoriteDto } from './dto/create-major-favorite.dto';
import { QueryMajorFavoriteDto } from './dto/query-major-favorite.dto';
import { ErrorCode } from '../common/constants/error-code.constant';
import { IPaginationResponse } from '../common/interfaces/response.interface';

/**
 * 专业收藏服务
 * 处理专业收藏相关的业务逻辑
 */
@Injectable()
export class MajorsService {
  private readonly logger = new Logger(MajorsService.name);

  constructor(
    @InjectRepository(MajorFavorite)
    private readonly majorFavoriteRepository: Repository<MajorFavorite>,
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
  ) {}

  /**
   * 收藏专业
   * @param userId 用户ID
   * @param createDto 创建收藏DTO
   * @returns 收藏记录
   */
  async createFavorite(
    userId: number,
    createDto: CreateMajorFavoriteDto,
  ): Promise<MajorFavorite> {
    // 检查专业是否存在
    const major = await this.majorRepository.findOne({
      where: { code: createDto.majorCode },
    });

    if (!major) {
      this.logger.warn(
        `专业不存在: ${createDto.majorCode}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '专业不存在',
      });
    }

    // 检查是否已经收藏
    const existingFavorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode: createDto.majorCode,
      },
    });

    if (existingFavorite) {
      this.logger.warn(
        `专业已收藏: ${createDto.majorCode}, 用户ID: ${userId}`,
      );
      throw new ConflictException({
        code: ErrorCode.OPERATION_FAILED,
        message: '该专业已收藏',
      });
    }

    // 创建收藏记录
    const favorite = this.majorFavoriteRepository.create({
      userId,
      majorCode: createDto.majorCode,
    });

    const savedFavorite = await this.majorFavoriteRepository.save(favorite);
    this.logger.log(
      `用户 ${userId} 收藏专业 ${createDto.majorCode} 成功`,
    );

    return savedFavorite;
  }

  /**
   * 取消收藏专业
   * @param userId 用户ID
   * @param majorCode 专业代码
   * @returns void
   */
  async removeFavorite(userId: number, majorCode: string): Promise<void> {
    // 查找收藏记录
    const favorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode,
      },
    });

    if (!favorite) {
      this.logger.warn(
        `收藏记录不存在: ${majorCode}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '收藏记录不存在',
      });
    }

    // 删除收藏记录
    await this.majorFavoriteRepository.remove(favorite);
    this.logger.log(`用户 ${userId} 取消收藏专业 ${majorCode} 成功`);
  }

  /**
   * 查询用户的收藏列表（分页）
   * @param userId 用户ID
   * @param queryDto 查询条件
   * @returns 分页的收藏列表
   */
  async findFavorites(
    userId: number,
    queryDto: QueryMajorFavoriteDto,
  ): Promise<IPaginationResponse<MajorFavorite>> {
    const { page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    // 查询收藏列表（包含专业信息）
    const [favorites, total] = await this.majorFavoriteRepository.findAndCount({
      where: { userId },
      relations: ['major'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // 计算总页数
    const totalPages = Math.ceil(total / limit);

    this.logger.log(
      `查询用户 ${userId} 的收藏列表，共 ${total} 条记录，当前第 ${page} 页`,
    );

    return {
      items: favorites,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * 检查用户是否已收藏某个专业
   * @param userId 用户ID
   * @param majorCode 专业代码
   * @returns 是否已收藏
   */
  async isFavorite(userId: number, majorCode: string): Promise<boolean> {
    const favorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode,
      },
    });

    return !!favorite;
  }

  /**
   * 获取用户的收藏数量
   * @param userId 用户ID
   * @returns 收藏数量
   */
  async getFavoriteCount(userId: number): Promise<number> {
    return await this.majorFavoriteRepository.count({
      where: { userId },
    });
  }
}

