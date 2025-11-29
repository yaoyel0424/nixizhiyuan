import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { User } from '../../entities/user.entity';
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
  }

