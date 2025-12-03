import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PopularMajorsController } from './popular-majors.controller';
import { PopularMajorsService } from './popular-majors.service';
import { PopularMajor } from '@/entities/popular-major.entity';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';

describe('PopularMajorsController', () => {
  let controller: PopularMajorsController;
  let service: PopularMajorsService;

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

  // Mock Service
  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCode: jest.fn(),
    findByLevel1: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PopularMajorsController],
      providers: [
        {
          provide: PopularMajorsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PopularMajorsController>(
      PopularMajorsController,
    );
    service = module.get<PopularMajorsService>(PopularMajorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该被定义', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('应该返回分页的热门专业列表', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
      };

      const mockResult = {
        items: mockPopularMajors,
        meta: {
          total: mockPopularMajors.length,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(queryDto);

      expect(result).toEqual({
        items: expect.any(Array),
        meta: mockResult.meta,
      });
      expect(result.items).toHaveLength(mockPopularMajors.length);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });

    it('应该支持筛选条件', async () => {
      const queryDto: QueryPopularMajorDto = {
        page: 1,
        limit: 10,
        level1: 'ben',
        name: '计算机',
      };

      const mockResult = {
        items: [mockPopularMajor],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });
  }); 

  describe('findByLevel1', () => {
    it('应该返回指定教育层次的热门专业列表', async () => {
      mockService.findByLevel1.mockResolvedValue(mockPopularMajors);

      const result = await controller.findByLevel1('ben');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(mockPopularMajors.length);
      expect(service.findByLevel1).toHaveBeenCalledWith('ben');
    });

    it('当没有匹配的记录时应该返回空数组', async () => {
      mockService.findByLevel1.mockResolvedValue([]);

      const result = await controller.findByLevel1('zhuan');

      expect(result).toEqual([]);
    });
  });
});

