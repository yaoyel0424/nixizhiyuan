import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * 调整方向
 */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
}

/**
 * 调整方向请求 DTO
 */
export class AdjustDirectionDto {
  @ApiProperty({
    description: '调整方向：up（上移）或 down（下移）',
    enum: Direction,
    example: Direction.UP,
  })
  @IsNotEmpty({ message: '调整方向不能为空' })
  @IsEnum(Direction, { message: '调整方向必须是 up 或 down' })
  direction: Direction;
}
