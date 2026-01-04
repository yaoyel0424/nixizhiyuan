import { ApiProperty } from '@nestjs/swagger';
import { Expose, Exclude } from 'class-transformer';

/**
 * 学校响应 DTO
 * 排除 id 字段
 */
export class SchoolResponseDto {
  @ApiProperty({
    description: '学校代码',
    example: '10001',
  })
  @Expose()
  code: string;

  @ApiProperty({
    description: '中文名称',
    example: '北京大学',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: '性质类型',
    example: '公办',
    required: false,
  })
  @Expose()
  nature: string | null;

  @ApiProperty({
    description: '教育层次',
    example: '本科',
    required: false,
  })
  @Expose()
  level: string | null;

  @ApiProperty({
    description: '所属部门',
    example: '教育部',
    required: false,
  })
  @Expose()
  belong: string | null;

  @ApiProperty({
    description: '类别',
    example: '综合类',
    required: false,
  })
  @Expose()
  categories: string | null;

  @ApiProperty({
    description: '特色',
    example: '985,211,双一流',
    required: false,
  })
  @Expose()
  features: string | null;

  @ApiProperty({
    description: '省份名称',
    example: '北京',
    required: false,
  })
  @Expose()
  provinceName: string | null;

  @ApiProperty({
    description: '城市名称',
    example: '北京市',
    required: false,
  })
  @Expose()
  cityName: string | null;

  @ApiProperty({
    description: '招生邮箱',
    example: 'admission@pku.edu.cn',
    required: false,
  })
  @Expose()
  admissionsEmail: string | null;

  @ApiProperty({
    description: '学校地址',
    example: '北京市海淀区颐和园路5号',
    required: false,
  })
  @Expose()
  address: string | null;

  @ApiProperty({
    description: '邮政编码',
    example: '100871',
    required: false,
  })
  @Expose()
  postcode: string | null;

  @ApiProperty({
    description: '招生网站',
    example: 'https://www.gotopku.cn',
    required: false,
  })
  @Expose()
  admissionsSite: string | null;

  @ApiProperty({
    description: '官方网站',
    example: 'https://www.pku.edu.cn',
    required: false,
  })
  @Expose()
  officialSite: string | null;

  @ApiProperty({
    description: '招生电话',
    example: '010-62751407',
    required: false,
  })
  @Expose()
  admissionsPhone: string | null;

  @ApiProperty({
    description: '综合排名',
    example: 1,
    required: false,
  })
  @Expose()
  rankingOfRK: number | null;

  @ApiProperty({
    description: '校友会排名',
    example: 1,
    required: false,
  })
  @Expose()
  rankingOfXYH: number | null;

  @Exclude()
  id: number;

  @Exclude()
  gbCode: string;

  @Exclude()
  artFeatures: string;

  @Exclude()
  provinceCode: string;

  @Exclude()
  hits: number;

  @Exclude()
  ranking: number;

  @Exclude()
  rankingOfWSL: number;

  @Exclude()
  rankingOfQS: number;

  @Exclude()
  rankingOfUSNews: number;

  @Exclude()
  rankingOfEdu: number;

  @Exclude()
  comScore: number;

  @Exclude()
  diffScore: number;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;
}

