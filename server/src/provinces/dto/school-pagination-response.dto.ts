import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { SchoolResponseDto } from './school-response.dto';

/**
 * 分页元数据响应 DTO
 */
export class PaginationMetaDto {
  @ApiProperty({
    description: '总记录数',
    example: 100,
  })
  @Expose()
  total: number;

  @ApiProperty({
    description: '当前页码',
    example: 1,
  })
  @Expose()
  page: number;

  @ApiProperty({
    description: '每页数量',
    example: 10,
  })
  @Expose()
  limit: number;

  @ApiProperty({
    description: '总页数',
    example: 10,
  })
  @Expose()
  totalPages: number;
}

/**
 * 院校分页响应 DTO
 */
export class SchoolPaginationResponseDto {
  @ApiProperty({
    description: '院校列表',
    type: [SchoolResponseDto],
  })
  @Expose()
  items: SchoolResponseDto[];

  @ApiProperty({
    description: '分页元数据',
    type: PaginationMetaDto,
  })
  @Expose()
  meta: PaginationMetaDto;
}

