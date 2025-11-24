import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { User } from '../entities/user.entity';
import { QueryUserDto } from '../dto/query-user.dto';
import { IPaginationResponse } from '../../common/interfaces/response.interface';

/**
 * 用户自定义仓储
 * 封装复杂的查询逻辑
 */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 分页查询用户
   */
  async findWithPagination(
    queryDto: QueryUserDto,
  ): Promise<IPaginationResponse<User>> {
    const { page, limit, sortBy, sortOrder, search } = queryDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};

    if (search) {
      where.username = Like(`%${search}%`);
    }

    const [items, total] = await this.userRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: {
        [sortBy]: sortOrder,
      },
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据用户名或邮箱查找用户
   */
  async findByUsernameOrEmail(
    usernameOrEmail: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
      ],
    });
  }
}

