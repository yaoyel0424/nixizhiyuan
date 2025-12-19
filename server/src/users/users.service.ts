import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './repositories/users.repository';
import { ErrorCode } from '../common/constants/error-code.constant';

/**
 * 用户服务
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly usersRepository: UsersRepository,
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
}

