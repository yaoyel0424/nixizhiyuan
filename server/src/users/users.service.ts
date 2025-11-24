import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UsersRepository } from './repositories/users.repository';
import { HashUtil } from '../common/utils/hash.util';
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
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // 检查用户名是否已存在
    const existingUser = await this.usersRepository.findByUsernameOrEmail(
      createUserDto.username,
    );
    if (existingUser) {
      throw new ConflictException({
        code: ErrorCode.USER_ALREADY_EXISTS,
        message: '用户名或邮箱已存在',
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingEmail) {
      throw new ConflictException({
        code: ErrorCode.USER_ALREADY_EXISTS,
        message: '邮箱已存在',
      });
    }

    // 加密密码
    const hashedPassword = await HashUtil.hashPassword(createUserDto.password);

    // 创建用户
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      roles: createUserDto.roles || ['user'],
    });

    return this.userRepository.save(user);
  }

  /**
   * 分页查询用户
   */
  async findAll(queryDto: QueryUserDto) {
    return this.usersRepository.findWithPagination(queryDto);
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

    // 如果更新密码，需要加密
    if (updateUserDto.password) {
      updateUserDto.password = await HashUtil.hashPassword(
        updateUserDto.password,
      );
    }

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
   * 根据用户名或邮箱查找用户（用于认证）
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    return this.usersRepository.findByUsernameOrEmail(usernameOrEmail);
  }
}

