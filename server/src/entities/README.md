# Entities 文件夹

此文件夹用于存放数据库实体（Entity）文件。

## 文件命名规范

- 所有实体文件必须以 `.entity.ts` 结尾
- 文件名使用 kebab-case，例如：`user-profile.entity.ts`

## 使用示例

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 示例实体
 */
@Entity('example_table')
export class Example {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
```

## 注意事项

- 实体文件会自动被 TypeORM 发现和加载
- 确保实体类使用 `@Entity()` 装饰器
- 建议每个实体文件只包含一个实体类

