import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Province } from '@/entities/province.entity';
import { CreateProvinceFavoriteDto } from './dto/create-province-favorite.dto';
import { ProvincesListResponseDto } from './dto/province-response.dto';
import { ErrorCode } from '../common/constants/error-code.constant';
import { IPaginationResponse } from '../common/interfaces/response.interface';

/**
 * 省份服务
 * 处理省份相关的业务逻辑
 */
@Injectable()
export class ProvincesService {
  private readonly logger = new Logger(ProvincesService.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(ProvinceFavorite)
    private readonly provinceFavoriteRepository: Repository<ProvinceFavorite>,
  ) {}

  /**
   * 查询所有省份
   * 返回省份列表和类型列表（去重）
   * @returns 省份列表和类型列表
   */
  async findAll(): Promise<ProvincesListResponseDto> {
    // 查询所有省份
    const provinces = await this.provinceRepository.find({
      order: { id: 'ASC' },
    });

    // 提取所有类型并去重
    const types = Array.from(
      new Set(provinces.map((province) => province.type)),
    ).sort();

    this.logger.log(`查询所有省份，共 ${provinces.length} 条，类型 ${types.length} 种`);

    return {
      provinces,
      types,
    };
  }

  /**
   * 收藏省份
   * @param userId 用户ID
   * @param createDto 创建收藏DTO
   * @returns 收藏记录
   */
  async createFavorite(
    userId: number,
    createDto: CreateProvinceFavoriteDto,
  ): Promise<ProvinceFavorite> {
    // 检查省份是否存在
    const province = await this.provinceRepository.findOne({
      where: { id: createDto.provinceId },
    });

    if (!province) {
      this.logger.warn(
        `省份不存在: ${createDto.provinceId}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '省份不存在',
      });
    }

    // 检查是否已经收藏
    const existingFavorite = await this.provinceFavoriteRepository.findOne({
      where: {
        userId,
        provinceId: createDto.provinceId,
      },
    });

    if (existingFavorite) {
      this.logger.warn(
        `省份已收藏: ${createDto.provinceId}, 用户ID: ${userId}`,
      );
      throw new ConflictException({
        code: ErrorCode.OPERATION_FAILED,
        message: '该省份已收藏',
      });
    }

    // 创建收藏记录
    const favorite = this.provinceFavoriteRepository.create({
      userId,
      provinceId: createDto.provinceId,
    });

    const savedFavorite = await this.provinceFavoriteRepository.save(favorite);
    this.logger.log(
      `用户 ${userId} 收藏省份 ${createDto.provinceId} 成功`,
    );

    return savedFavorite;
  }

  /**
   * 取消收藏省份
   * @param userId 用户ID
   * @param provinceId 省份ID
   * @returns void
   */
  async removeFavorite(userId: number, provinceId: number): Promise<void> {
    // 查找收藏记录
    const favorite = await this.provinceFavoriteRepository.findOne({
      where: {
        userId,
        provinceId,
      },
    });

    if (!favorite) {
      this.logger.warn(
        `收藏记录不存在: ${provinceId}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '收藏记录不存在',
      });
    }

    // 删除收藏记录
    await this.provinceFavoriteRepository.remove(favorite);
    this.logger.log(`用户 ${userId} 取消收藏省份 ${provinceId} 成功`);
  }

  /**
   * 查询用户的收藏列表
   * @param userId 用户ID
   * @returns 收藏列表（包含省份信息）
   */
  async findFavorites(userId: number): Promise<ProvinceFavorite[]> {
    // 查询收藏列表（包含省份信息）
    const favorites = await this.provinceFavoriteRepository.find({
      where: { userId },
      relations: ['province'],
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`查询用户 ${userId} 的收藏列表，共 ${favorites.length} 条记录`);

    return favorites;
  }

  /**
   * 检查用户是否已收藏某个省份
   * @param userId 用户ID
   * @param provinceId 省份ID
   * @returns 是否已收藏
   */
  async isFavorite(userId: number, provinceId: number): Promise<boolean> {
    const favorite = await this.provinceFavoriteRepository.findOne({
      where: {
        userId,
        provinceId,
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
    return await this.provinceFavoriteRepository.count({
      where: { userId },
    });
  }
}

