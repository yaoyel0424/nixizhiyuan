import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PopularMajorsService } from './popular-majors.service';
import { PopularMajor } from '@/entities/popular-major.entity';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';
import { ErrorCode } from '../common/constants/error-code.constant';

describe('PopularMajorsService', () => {
  let service: PopularMajorsService;
  let repository: Repository<PopularMajor>;

  // Mock 数据
  const mockPopularMajor: PopularMajor = {
    id: 1,
    name: '计算机科学与技术',
    level1: 'ben',
    code: '080901',
    degree: '理学学士,工学学士',
    limitYear: '四年',
    averageSalary: '130876',
    fiveAverageSalary: 14200,
    createdAt: new Date(),
    updatedAt: new Date(),
    majorDetail: null,
  };

  const mockPopularMajors: PopularMajor[] = [
    mockPopularMajor,
    {
      id: 2,
      name: '软件工程',
      level1: 'ben',
      code: '080902',
      degree: '工学学士',
      limitYear: '四年',
      averageSalary: '131294',
      fiveAverageSalary: 16700,
      createdAt: new Date(),
      updatedAt: new Date(),
      majorDetail: null,
    },
  ];

  // Mock Repository
  const mockRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  // Mock Logger
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopularMajorsService,
        {
          provide: getRepositoryToken(PopularMajor),
          useValue: mockRepository,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<PopularMajorsService>(PopularMajorsService);
    repository = module.get<Repository<PopularMajor>>(
      getRepositoryToken(PopularMajor),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('应该返回分页的热门专业列表', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'ASC',
      };

      mockRepository.findAndCount.mockResolvedValue([
        mockPopularMajors,
        mockPopularMajors.length,
      ]);

      const result = await service.findAll(queryDto);

      expect(result).toEqual({
        items: mockPopularMajors,
        meta: {
          total: mockPopularMajors.length,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        relations: ['majorDetail'],
        order: { id: 'ASC' },
        skip: 0,
        take: 10,
      });
    });

    it('应该支持按 level1 筛选', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        level1: 'ben',
      };

      mockRepository.findAndCount.mockResolvedValue([
        mockPopularMajors,
        mockPopularMajors.length,
      ]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { level1: 'ben' },
        relations: ['majorDetail'],
        order: { id: 'ASC' },
        skip: 0,
        take: 10,
      });
    });

    it('应该支持按 name 模糊搜索', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        name: '计算机',
      };

      mockRepository.findAndCount.mockResolvedValue([
        [mockPopularMajor],
        1,
      ]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { name: expect.any(Object) },
        relations: ['majorDetail'],
        order: { id: 'ASC' },
        skip: 0,
        take: 10,
      });
    });

    it('应该支持按 code 精确搜索', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        code: '080901',
      };

      mockRepository.findAndCount.mockResolvedValue([
        [mockPopularMajor],
        1,
      ]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { code: '080901' },
        relations: ['majorDetail'],
        order: { id: 'ASC' },
        skip: 0,
        take: 10,
      });
    });

    it('应该支持分页', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 2,
        limit: 5,
      };

      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        relations: ['majorDetail'],
        order: { id: 'ASC' },
        skip: 5,
        take: 5,
      });
    });

    it('应该支持排序', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'DESC',
      };

      mockRepository.findAndCount.mockResolvedValue([
        mockPopularMajors,
        mockPopularMajors.length,
      ]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        relations: ['majorDetail'],
        order: { name: 'DESC' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('应该返回指定 ID 的热门专业', async () => {
      mockRepository.findOne.mockResolvedValue(mockPopularMajor);

      const result = await service.findOne(1);

      expect(result).toEqual(mockPopularMajor);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['majorDetail', 'majorDetail.major'],
      });
    });

    it('当热门专业不存在时应该抛出 NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('热门专业不存在');
    });
  });

  describe('findByCode', () => {
    it('应该返回指定 code 的热门专业', async () => {
      mockRepository.findOne.mockResolvedValue(mockPopularMajor);

      const result = await service.findByCode('080901');

      expect(result).toEqual(mockPopularMajor);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { code: '080901' },
        relations: ['majorDetail'],
      });
    });

    it('当热门专业不存在时应该返回 null', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByCode('999999');

      expect(result).toBeNull();
    });
  });

  describe('findByLevel1', () => {
    it('应该返回指定教育层次的热门专业列表', async () => {
      mockRepository.find.mockResolvedValue(mockPopularMajors);

      const result = await service.findByLevel1('ben');

      expect(result).toEqual(mockPopularMajors);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { level1: 'ben' },
        relations: ['majorDetail'],
        order: { id: 'ASC' },
      });
    });

    it('当没有匹配的记录时应该返回空数组', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findByLevel1('zhuan');

      expect(result).toEqual([]);
    });
  });
});

