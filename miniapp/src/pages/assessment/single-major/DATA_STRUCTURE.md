# 喜欢与天赋概览数据结构说明

## 数据来源

数据来自 `majorDetail.majorElementAnalyses`，是一个数组类型。

## 数据结构

```typescript
interface MajorElementAnalysis {
  // 分析记录ID
  id: number
  
  // 分析类型，用于分类
  // - "lexue" (乐学) → 积极助力项
  // - "shanxue" (善学) → 积极助力项
  // - "tiaozhan" (阻学) → 潜在挑战项
  // - "yanxue" (厌学) → 潜在挑战项
  type: 'lexue' | 'shanxue' | 'tiaozhan' | 'yanxue'
  
  // 权重
  weight: number
  
  // 元素信息
  element?: {
    // 元素ID，用于关联问卷题目
    id: number
    
    // 元素名称，显示在列表中
    name: string
    
    // 维度（如："做"、"看"、"听"等）
    dimension?: string
    
    // 拥有的自然状态描述
    ownedNaturalState?: string
    
    // 元素类型（如："like"）
    type?: string
    
    // 未拥有的自然状态描述
    unownedNaturalState?: string
    
    // 状态
    status?: string
  }
  
  // 匹配原因
  matchReason?: string
  
  // 摘要
  summary?: string
  
  // 理论基础
  theoryBasis?: string
  
  // 用户对该元素的评分
  userElementScore?: number
}
```

## 数据示例

```json
{
  "id": 7639,
  "type": "lexue",
  "weight": 1,
  "element": {
    "id": 21,
    "name": "做—能独立完成的—偏思维运算类",
    "dimension": "做",
    "ownedNaturalState": "经常主动验证方法的"正确性"",
    "type": "like",
    "unownedNaturalState": "天生喜欢不明显:又要动"
  },
  "matchReason": "现代汽车维修是典型的"手脑并用"工作",
  "summary": "手脑并用验证想法的任务,特指汽车故障诊",
  "theoryBasis": "(同机电技术教育乐学特质1)",
  "userElementScore": 5
}
```

## 数据处理流程

### 1. 统计数量 (`getAnalysisCounts`)

根据 `type` 字段统计积极助力项和潜在挑战项的数量：

```typescript
// 积极助力项
- type === "lexue" (乐学)
- type === "shanxue" (善学)

// 潜在挑战项
- type === "tiaozhan" (阻学)
- type === "yanxue" (厌学)
```

### 2. 分组显示 (`MajorElementAnalysesDisplay`)

将分析数据按类型分组：

- **积极助力**：包含所有 `lexue` 和 `shanxue` 类型的分析
- **潜在挑战**：包含所有 `tiaozhan` 和 `yanxue` 类型的分析
- **其他类型**：按原始类型名称分组

### 3. 显示字段

在详情对话框中，每个分析项展开后显示：

- **元素名称** (`element.name`)：显示在列表项标题
- **摘要** (`summary`)：简要说明
- **匹配原因** (`matchReason`)：为什么匹配这个专业
- **状态** (`element.status`)：元素状态（如果有）
- **查看问卷**：通过 `element.id` 关联问卷题目

### 4. 问卷关联

通过 `element.id` 从 `questionnaire.json` 中筛选相关的问卷题目：

```typescript
const elementIds = analyses
  .map(analysis => analysis?.element?.id)
  .filter(id => id !== undefined && id !== null)

// 筛选问卷题目
const questions = questionnaireData.filter(
  q => elementIds.includes(q.elementId)
)
```

## 使用场景

1. **喜欢与天赋概览卡片**：显示积极助力项和潜在挑战项的数量
2. **详情对话框**：展开查看每个分析项的详细信息
3. **问卷功能**：通过 `element.id` 关联并显示相关问卷题目

