import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * 调整索引类型
 */
export enum IndexType {
  MG_INDEX = 'mg_index',
  MAJOR_INDEX = 'major_index',
}

/**
 * 调整方向
 */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
}

/**
 * 调整索引请求 DTO
 */
export class AdjustIndexDto {
  @ApiProperty({
    description: '调整类型：mg_index（专业组索引）或 major_index（专业索引）',
    enum: IndexType,
    example: IndexType.MG_INDEX,
  })
  @IsNotEmpty({ message: '调整类型不能为空' })
  @IsEnum(IndexType, { message: '调整类型必须是 mg_index 或 major_index' })
  indexType: IndexType;

  @ApiProperty({
    description: '调整方向：up（上移）或 down（下移）',
    enum: Direction,
    example: Direction.UP,
  })
  @IsNotEmpty({ message: '调整方向不能为空' })
  @IsEnum(Direction, { message: '调整方向必须是 up 或 down' })
  direction: Direction;
}
