import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsInt, IsString, IsArray, IsOptional } from 'class-validator';

/**
 * 调整方向
 */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
}

/**
 * 调整 mg_index 请求 DTO
 */
export class AdjustMgIndexDto {
  @ApiProperty({
    description: '专业组索引',
    type: Number,
    example: 1,
  })
  @IsNotEmpty({ message: '专业组索引不能为空' })
  @IsInt({ message: '专业组索引必须是整数' })
  mgIndex: number;


  @ApiProperty({
    description: '调整方向：up（上移）或 down（下移）',
    enum: Direction,
    example: Direction.UP,
  })
  @IsNotEmpty({ message: '调整方向不能为空' })
  @IsEnum(Direction, { message: '调整方向必须是 up 或 down' })
  direction: Direction;
}
