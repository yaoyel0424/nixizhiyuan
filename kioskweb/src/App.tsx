// 代码已包含 CSS：Tailwind + `styles/kiosk-app.css`（由 MasterGo / App copy 工具类等价抽出）

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import imgDecorCloud from './assets/1776429819509a3K9mP2xQ7vN4rT8wY.jpg';
import imgDecorLeaf from './assets/1776429819509b4L8nQ3yR6sU9vW1xZ.jpg';
import imgQrcode from './assets/qrcode.jpg';
import imgWeappLogo from './assets/weapplogo.png';
import { CHINA_PROVINCES, DEFAULT_PROVINCE } from './data/china-provinces';

/** 与本地 mock 一致的专业大类结构（筛选函数入参） */
type MajorCategoryBlock = {
  name: string;
  count: number;
  subCategories: Array<{
    name: string;
    count: number;
    majors: Array<{
      id: number | null;
      name: string;
      code: string;
    }>;
  }>;
};

type KioskTab = '本科' | '职业本科' | '专科';

type ApiMajorNode = {
  id: number | null;
  name: string;
  code: string;
  eduLevel: 'ben' | 'gao_ben' | 'zhuan' | string;
  siteAllocationCode: string | null;
  level: 1 | 2 | 3;
  children: ApiMajorNode[];
};

type ApiMajorGroup = {
  eduLevel: 'ben' | 'gao_ben' | 'zhuan' | string;
  tree: ApiMajorNode[];
};

type ApiMajorTreeResponse = {
  data?: {
    groups?: ApiMajorGroup[];
  };
};

const MAJOR_TREE_API_URL = 'https://ziquzixin.com/api/v1/kiosk/majors/tree';
const MAJOR_IDS_API_URL = 'https://ziquzixin.com/api/v1/kiosk/level3-major-ids';
const ANONYMOUS_USERS_API_URL = 'https://ziquzixin.com/api/v1/kiosk/anonymous-users';
const ANONYMOUS_SCALE_ANSWERS_API_URL = 'https://ziquzixin.com/api/v1/kiosk/anonymous-scale-answers';
const MAJOR_TREE_CACHE_KEY = 'kiosk-major-tree-v1';

type KioskScaleQuestionOption = {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  score: number;
};

type KioskScaleQuestion = {
  scaleId: number;
  title: string;
  options: KioskScaleQuestionOption[];
};

type KioskMajorScoreResult = {
  majorId?: number;
  majorCode?: string;
  majorName?: string;
  majorBrief?: string;
  eduLevel?: string;
  score?: number;
  lexueScore?: number;
  shanxueScore?: number;
  yanxueDeduction?: number;
  tiaozhanDeduction?: number;
  sign?: string;
  matchScore?: number;
  [key: string]: unknown;
};

/**
 * 接口学历层级映射到页面 Tab。
 */
function mapEduLevelToTab(eduLevel: string): KioskTab | null {
  if (eduLevel === 'ben') {
    return '本科';
  }
  if (eduLevel === 'gao_ben') {
    return '职业本科';
  }
  if (eduLevel === 'zhuan') {
    return '专科';
  }
  return null;
}

/**
 * 省份参数标准化：接口通常使用“湖南/北京/广西”等简称。
 * 例如：湖南省 -> 湖南，广西壮族自治区 -> 广西，香港特别行政区 -> 香港。
 */
function normalizeProvinceForApi(province: string): string {
  return province
    .replace(/特别行政区$/u, '')
    .replace(/壮族自治区$/u, '')
    .replace(/回族自治区$/u, '')
    .replace(/维吾尔自治区$/u, '')
    .replace(/自治区$/u, '')
    .replace(/省$/u, '')
    .replace(/市$/u, '');
}

/**
 * 把接口树结构转换为页面渲染结构（大类 -> 小类 -> 专业）。
 */
function transformApiTreeToBlocks(tree: ApiMajorNode[]): MajorCategoryBlock[] {
  return tree.map((level1) => {
    const subCategories = (level1.children ?? []).map((level2) => {
      const majors = (level2.children ?? []).map((level3) => ({
        id: level3.id,
        name: level3.name,
        code: level3.code
      }));
      return {
        name: level2.name,
        count: majors.length,
        majors
      };
    });
    const count = subCategories.reduce((acc, sub) => acc + sub.majors.length, 0);
    return {
      name: level1.name,
      count,
      subCategories
    };
  });
}

/**
 * 把接口分组转换为页面三个 Tab 的数据容器。
 */
function normalizeMajorGroups(groups: ApiMajorGroup[]): Record<KioskTab, MajorCategoryBlock[]> {
  const next: Record<KioskTab, MajorCategoryBlock[]> = {
    本科: [],
    职业本科: [],
    专科: []
  };

  groups.forEach((group) => {
    const tab = mapEduLevelToTab(group.eduLevel);
    if (!tab) {
      return;
    }
    next[tab] = transformApiTreeToBlocks(group.tree ?? []);
  });

  return next;
}

/**
 * 按关键词过滤专业树：大类名、小类名或具体专业名命中（子串）即保留。
 * @param blocks 当前 Tab 下的专业大类列表
 * @param query 用户输入，首尾空白不参与匹配
 */
function filterMajorCategories(blocks: MajorCategoryBlock[], query: string): MajorCategoryBlock[] {
  const q = query.trim();
  if (!q) {
    return blocks;
  }

  const next: MajorCategoryBlock[] = [];

  for (const major of blocks) {
    if (major.name.includes(q)) {
      next.push(major);
      continue;
    }

    const subs: MajorCategoryBlock['subCategories'] = [];

    for (const sub of major.subCategories) {
      if (sub.name.includes(q)) {
        subs.push(sub);
        continue;
      }

      const majorsHit = sub.majors.filter((major) => major.name.includes(q));
      if (majorsHit.length > 0) {
        subs.push({
          ...sub,
          majors: majorsHit,
          count: majorsHit.length
        });
      }
    }

    if (subs.length > 0) {
      next.push({
        ...major,
        subCategories: subs,
        count: subs.reduce((acc, sub) => acc + sub.majors.length, 0)
      });
    }
  }

  return next;
}

/**
 * 根据 level3 专业 id 过滤专业树（用于匹配查询结果）。
 */
function filterMajorCategoriesByIds(
  blocks: MajorCategoryBlock[],
  idSet: Set<number> | null
): MajorCategoryBlock[] {
  if (!idSet) {
    return blocks;
  }

  const next: MajorCategoryBlock[] = [];
  for (const major of blocks) {
    const subCategories = major.subCategories
      .map((sub) => {
        const majors = sub.majors.filter((item) => item.id !== null && idSet.has(item.id));
        return {
          ...sub,
          majors,
          count: majors.length
        };
      })
      .filter((sub) => sub.majors.length > 0);

    if (subCategories.length > 0) {
      next.push({
        ...major,
        subCategories,
        count: subCategories.reduce((acc, sub) => acc + sub.majors.length, 0)
      });
    }
  }

  return next;
}

/**
 * 基于关键词计算当前应默认展开的大类名称集合（用于搜索态）。
 */
function getExpandedMajorNamesByQuery(
  blocks: MajorCategoryBlock[],
  query: string
): string[] {
  if (!query.trim()) {
    return [];
  }
  return filterMajorCategories(blocks, query).map((item) => item.name);
}

/**
 * 将名称数组快速转换为专业项（mock 兜底数据使用，id 置空）。
 */
function toMockMajors(names: string[]) {
  return names.map((name, index) => ({ id: null, name, code: `mock-${index + 1}` }));
}

function buildFallbackOptions(): KioskScaleQuestionOption[] {
  return [
    { key: 'A', text: '非常符合', score: 5 },
    { key: 'B', text: '比较符合', score: 4 },
    { key: 'C', text: '一般', score: 3 },
    { key: 'D', text: '较不符合', score: 2 },
    { key: 'E', text: '非常不符合', score: 1 }
  ];
}

function normalizeScaleOptions(scale: Record<string, unknown>): KioskScaleQuestionOption[] {
  const fromArray = scale.options;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    const mapped = fromArray
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            key: (['A', 'B', 'C', 'D', 'E'][index] ?? 'E') as KioskScaleQuestionOption['key'],
            text: item,
            score: index + 1
          };
        }
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const optionName = String(
            obj.optionName ?? obj.text ?? obj.label ?? obj.content ?? `选项${index + 1}`
          );
          const matchedKey = optionName.match(/^\s*([A-E])\./i)?.[1]?.toUpperCase();
          return {
            key: (
              String(
                obj.key ?? matchedKey ?? ['A', 'B', 'C', 'D', 'E'][index] ?? 'E'
              ) as KioskScaleQuestionOption['key']
            ),
            text: optionName,
            score: Number(obj.optionValue ?? obj.score ?? obj.value ?? index + 1)
          };
        }
        return null;
      })
      .filter((item): item is KioskScaleQuestionOption => Boolean(item));
    if (mapped.length > 0) {
      return mapped;
    }
  }

  const keyed = ['A', 'B', 'C', 'D', 'E']
    .map((key, index) => {
      const text = scale[`option${key}`] ?? scale[`answer${key}`] ?? scale[`choice${key}`];
      if (!text) {
        return null;
      }
      return {
        key: key as KioskScaleQuestionOption['key'],
        text: String(text),
        score: Number(scale[`score${key}`] ?? index + 1)
      };
    })
    .filter((item): item is KioskScaleQuestionOption => Boolean(item));
  if (keyed.length > 0) {
    return keyed;
  }

  return buildFallbackOptions();
}

function extractScaleQuestions(payload: unknown): KioskScaleQuestion[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  /** 官方结构：data.analyses[].scales[] */
  if (Array.isArray(data.analyses)) {
    const questions = data.analyses
      .flatMap((analysis) => {
        if (!analysis || typeof analysis !== 'object') {
          return [];
        }
        const scales = (analysis as Record<string, unknown>).scales;
        return Array.isArray(scales) ? scales : [];
      })
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const scale = item as Record<string, unknown>;
        const scaleId = Number(scale.id ?? scale.scaleId);
        if (!Number.isFinite(scaleId) || scaleId <= 0) {
          return null;
        }
        const title = String(scale.content ?? scale.title ?? scale.question ?? `第${index + 1}题`);
        return {
          scaleId,
          title,
          options: normalizeScaleOptions(scale)
        };
      })
      .filter((item): item is KioskScaleQuestion => Boolean(item));
    if (questions.length > 0) {
      return questions;
    }
  }

  /** 兜底：兼容旧结构 data.scales / data.list */
  const list = [data.scales, data.list, data.items, data.records].find((item) => Array.isArray(item));
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const scale = item as Record<string, unknown>;
      const scaleId = Number(scale.scaleId ?? scale.id);
      if (!Number.isFinite(scaleId) || scaleId <= 0) {
        return null;
      }
      const title = String(scale.title ?? scale.question ?? scale.name ?? `第${index + 1}题`);
      return {
        scaleId,
        title,
        options: normalizeScaleOptions(scale)
      };
    })
    .filter((item): item is KioskScaleQuestion => Boolean(item));
}

function extractAnonymousUserId(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const id = Number(data.id ?? data.anonymousUserId ?? data.userId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function extractMajorScoreResult(payload: unknown): KioskMajorScoreResult | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  return data as KioskMajorScoreResult;
}

/** 本地演示用专业列表（含本科 / 职业本科 / 专科） */
const mockResults = {
    本科: [
      {
        name: '工学类',
        count: 12,
        subCategories: [
          {
            name: '计算机类',
            count: 3,
            majors: toMockMajors(['计算机科学与技术', '软件工程', '网络工程'])
          },
          {
            name: '机械类',
            count: 2,
            majors: toMockMajors(['机械工程', '工业设计'])
          }
        ]
      },
      {
        name: '理学类',
        count: 8,
        subCategories: [
          {
            name: '数学类',
            count: 2,
            majors: toMockMajors(['数学与应用数学', '信息与计算科学'])
          },
          {
            name: '物理学类',
            count: 1,
            majors: toMockMajors(['物理学'])
          }
        ]
      },
      {
        name: '文学类',
        count: 5,
        subCategories: [
          {
            name: '外国语言文学类',
            count: 3,
            majors: toMockMajors(['英语', '日语', '法语'])
          }
        ]
      }
    ],
    职业本科: [
      {
        name: '工程技术类',
        count: 6,
        subCategories: [
          {
            name: '智能制造类',
            count: 2,
            majors: toMockMajors(['智能制造工程技术', '自动化技术与应用'])
          }
        ]
      }
    ],
    专科: [
      {
        name: '电子信息类',
        count: 4,
        subCategories: [
          {
            name: '计算机类',
            count: 2,
            majors: toMockMajors(['计算机应用技术', '软件技术'])
          }
        ]
      },
      {
        name: '财经商贸类',
        count: 7,
        subCategories: [
          {
            name: '财务会计类',
            count: 3,
            majors: toMockMajors(['大数据与会计', '财务管理', '会计信息管理'])
          }
        ]
      }
    ]
};

/**
 * 新高考选科助手主界面：左侧筛选项、右侧专业结果与专业搜索（当前为本地 mock 数据演示）。
 */
const App: React.FC = () => {
  const [selectedProvince, setSelectedProvince] = useState<string>(DEFAULT_PROVINCE);
  const [provinceModalOpen, setProvinceModalOpen] = useState(false);
  /** 首选默认物理；仍支持用户切换为历史 */
  const [firstSubject, setFirstSubject] = useState<'物理' | '历史' | null>('物理');
  /** 次选默认化学 + 生物；保持四选二规则 */
  const [secondSubjects, setSecondSubjects] = useState<string[]>(['化学', '生物']);
  const [activeTab, setActiveTab] = useState<KioskTab>('本科');
  const [expandedMajor, setExpandedMajor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  /** 默认直接展示右侧统计、Tab 与专业列表 */
  const [resultsUnlocked, setResultsUnlocked] = useState(true);
  /** 专业列表关键词（右侧顶部搜索，适配大屏触控） */
  const [majorQuery, setMajorQuery] = useState('');
  /** 接口专业树（按学历层级分组） */
  const [majorDataByTab, setMajorDataByTab] = useState<Record<KioskTab, MajorCategoryBlock[]>>({
    本科: [],
    职业本科: [],
    专科: []
  });
  /** 首次加载状态：用于展示「正在加载专业数据」 */
  const [isMajorTreeLoading, setIsMajorTreeLoading] = useState(true);
  /** 接口异常信息 */
  const [majorTreeError, setMajorTreeError] = useState<string | null>(null);
  /** 选科校验提示弹框文案（为空则关闭弹框） */
  const [selectionAlertMessage, setSelectionAlertMessage] = useState<string | null>(null);
  /** 匹配接口返回的 level3 id 过滤结果；null 代表不过滤（显示全部） */
  const [matchedIdSetByTab, setMatchedIdSetByTab] = useState<
    Record<KioskTab, Set<number> | null>
  >({
    本科: null,
    职业本科: null,
    专科: null
  });
  /**
   * 有关键词时：每个大类独立可展开/收起（与无搜索时的手风琴 `expandedMajor` 分离）。
   * 关键词或筛选结果变化时由 effect 同步为「当前列表项默认全部展开」。
   */
  const [searchExpandedNames, setSearchExpandedNames] = useState<string[]>([]);
  /** 避免首屏默认匹配重复触发 */
  const hasAutoTriggeredMatchRef = useRef(false);
  /** 自测弹窗：打开状态、答题页/结果页、当前题号、答案记录 */
  const [selfTestOpen, setSelfTestOpen] = useState(false);
  const [selfTestStep, setSelfTestStep] = useState<'quiz' | 'result' | 'loading'>('loading');
  const [selfTestMajorName, setSelfTestMajorName] = useState('临床医学');
  const [selfTestMajorCode, setSelfTestMajorCode] = useState('');
  const [selfTestAnonymousUserId, setSelfTestAnonymousUserId] = useState<number | null>(null);
  const [selfTestQuestions, setSelfTestQuestions] = useState<KioskScaleQuestion[]>([]);
  const [selfTestCurrentIndex, setSelfTestCurrentIndex] = useState(0);
  const [selfTestAnswers, setSelfTestAnswers] = useState<Array<number | null>>([]);
  const [selfTestBusy, setSelfTestBusy] = useState(false);
  const [selfTestError, setSelfTestError] = useState<string | null>(null);
  const [selfTestResult, setSelfTestResult] = useState<KioskMajorScoreResult | null>(null);

  /** 按 Escape 关闭省份弹窗 */
  useEffect(() => {
    if (!provinceModalOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProvinceModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [provinceModalOpen]);

  const firstSubjectsOptions = ['物理', '历史'] as const;
  const secondSubjectsOptions = ['化学', '生物', '政治', '地理'];

  /** 首选二选一：点另一项会切换选中；再点当前选中项则清空 */
  const handleFirstSubjectClick = (subject: '物理' | '历史') => {
    setFirstSubject((prev) => (prev === subject ? null : subject));
  };

  /** 次选四选二：未选中且已满 2 个时不增加；再点已选项可取消 */
  const MAX_SECOND_SUBJECTS = 2;

  const handleSecondSubjectToggle = (subject: string) => {
    setSecondSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((s) => s !== subject);
      }
      if (prev.length >= MAX_SECOND_SUBJECTS) {
        return prev;
      }
      return [...prev, subject];
    });
  };

  /**
   * 搜索输入：同步更新关键词，并默认展开当前筛选结果中的所有大类。
   */
  const handleMajorQueryChange = (nextQuery: string) => {
    setMajorQuery(nextQuery);
    const byIds = filterMajorCategoriesByIds(
      majorDataByTab[activeTab] ?? [],
      matchedIdSetByTab[activeTab]
    );
    setSearchExpandedNames(getExpandedMajorNamesByQuery(byIds, nextQuery));
  };

  /**
   * 次选科目参数：逗号分隔（与 users.secondarySubjects 语义一致）。
   */
  const buildSecondarySubjectsParam = (subjects: string[]) => {
    return subjects.map((item) => item.trim()).filter(Boolean).join(',');
  };

  /**
   * 解析匹配接口返回中的 id 列表（兼容常见字段结构）。
   */
  const parseMatchedIds = (payload: unknown): number[] => {
    if (!payload || typeof payload !== 'object') {
      return [];
    }
    const root = payload as Record<string, unknown>;
    const data = (root.data ?? root) as Record<string, unknown>;
    const candidates = [data.ids, data.majorIds, data.level3MajorIds, data.list];
    for (const item of candidates) {
      if (Array.isArray(item)) {
        return item
          .map((value) => {
            if (typeof value === 'number' || typeof value === 'string') {
              return Number(value);
            }
            if (value && typeof value === 'object' && 'id' in value) {
              return Number((value as { id: unknown }).id);
            }
            return NaN;
          })
          .filter((value) => Number.isFinite(value) && value > 0);
      }
    }
    return [];
  };

  /**
   * 加载专业树：优先读取会话缓存，再后台刷新接口，减轻 1900+ 专业首次等待。
   */
  const loadMajorTree = useCallback(async (showBusy = false) => {
    if (showBusy) {
      setIsSearching(true);
    }
    setMajorTreeError(null);

    try {
      const cachedRaw = sessionStorage.getItem(MAJOR_TREE_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as Record<KioskTab, MajorCategoryBlock[]>;
        setMajorDataByTab(cached);
        setIsMajorTreeLoading(false);
      }
    } catch {
      sessionStorage.removeItem(MAJOR_TREE_CACHE_KEY);
    }

    try {
      const response = await fetch(MAJOR_TREE_API_URL);
      if (!response.ok) {
        throw new Error(`接口返回异常：${response.status}`);
      }
      const payload = (await response.json()) as ApiMajorTreeResponse;
      const groups = payload.data?.groups ?? [];
      const normalized = normalizeMajorGroups(groups);
      setMajorDataByTab(normalized);
      setExpandedMajor((prev) => prev ?? normalized['本科'][0]?.name ?? null);
      setIsMajorTreeLoading(false);
      sessionStorage.setItem(MAJOR_TREE_CACHE_KEY, JSON.stringify(normalized));
    } catch (error) {
      setIsMajorTreeLoading(false);
      setMajorTreeError(error instanceof Error ? error.message : '专业数据加载失败');
      /** 无数据时保留本地 mock 兜底，避免右侧完全空白 */
      setMajorDataByTab(mockResults as Record<KioskTab, MajorCategoryBlock[]>);
    } finally {
      if (showBusy) {
        setIsSearching(false);
      }
    }
  }, []);

  /**
   * 开始匹配：保留按钮交互，触发一次手动刷新。
   */
  const handleSearch = useCallback(() => {
    if (!selectedProvince) {
      setSelectionAlertMessage('请先选择省份后再开始匹配。');
      return;
    }

    if (!firstSubject) {
      setSelectionAlertMessage('请先完成首选科目（二选一）后再开始匹配。');
      return;
    }

    if (secondSubjects.length !== 2) {
      setSelectionAlertMessage('次选科目需恰好选择 2 门（四选二），请调整后重试。');
      return;
    }

    setResultsUnlocked(true);
    setIsSearching(true);
    setMajorTreeError(null);

    const run = async () => {
      try {
        const nextMatched: Record<KioskTab, Set<number> | null> = {
          本科: null,
          职业本科: null,
          专科: null
        };

        const normalizedProvince = normalizeProvinceForApi(selectedProvince);
        const params = new URLSearchParams({
          province: normalizedProvince,
          preferredSubjects: firstSubject,
          secondarySubjects: buildSecondarySubjectsParam(secondSubjects)
        });
        const response = await fetch(`${MAJOR_IDS_API_URL}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`匹配接口异常：${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        const ids = parseMatchedIds(payload);
        const matchedSet = new Set(ids);
        nextMatched.本科 = matchedSet;
        nextMatched.职业本科 = matchedSet;
        nextMatched.专科 = matchedSet;
        setMatchedIdSetByTab(nextMatched);
        if (majorQuery.trim()) {
          const byIds = filterMajorCategoriesByIds(
            majorDataByTab[activeTab] ?? [],
            nextMatched[activeTab]
          );
          setSearchExpandedNames(getExpandedMajorNamesByQuery(byIds, majorQuery));
        }
      } catch (error) {
        setMajorTreeError(error instanceof Error ? error.message : '匹配专业失败');
      } finally {
        setIsSearching(false);
      }
    };

    void run();
  }, [activeTab, firstSubject, majorDataByTab, majorQuery, secondSubjects, selectedProvince]);

  /**
   * 首屏默认加载全部专业。
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMajorTree();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMajorTree]);

  /**
   * 首屏数据加载完成后，自动按默认条件（湖南/物理/化学生物）执行一次匹配。
   */
  useEffect(() => {
    if (hasAutoTriggeredMatchRef.current || isMajorTreeLoading) {
      return;
    }
    hasAutoTriggeredMatchRef.current = true;
    const timer = window.setTimeout(() => {
      handleSearch();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isMajorTreeLoading, handleSearch]);

  /** 按搜索框关键词过滤后的列表（含大类 / 小类 / 专业名匹配） */
  const filteredResults = useMemo(() => {
    const byIds = filterMajorCategoriesByIds(
      majorDataByTab[activeTab] ?? [],
      matchedIdSetByTab[activeTab]
    );
    return filterMajorCategories(byIds, majorQuery);
  }, [activeTab, majorDataByTab, matchedIdSetByTab, majorQuery]);

  /** 与下方统计卡片一致的汇总数字（随筛选变化） */
  const { totalMajors, totalSubCategories, totalSpecialties } = useMemo(() => {
    let majors = 0;
    let subCategories = 0;
    let specialties = 0;
    filteredResults.forEach((major) => {
      majors++;
      subCategories += major.subCategories.length;
      major.subCategories.forEach((sub) => {
        specialties += sub.majors.length;
      });
    });
    return {
      totalMajors: majors,
      totalSubCategories: subCategories,
      totalSpecialties: specialties
    };
  }, [filteredResults]);

  const searchTrimmed = majorQuery.trim();

  /**
   * 某个大类下的专业树是否展开。
   * @param majorName 大类名称
   */
  const isMajorRowExpanded = (majorName: string) => {
    if (searchTrimmed.length > 0) {
      return searchExpandedNames.includes(majorName);
    }
    return expandedMajor === majorName;
  };

  const currentSelfTestQuestion = selfTestQuestions[selfTestCurrentIndex];
  const selfTestTotal = selfTestQuestions.length;
  const currentSelfTestAnswer = selfTestAnswers[selfTestCurrentIndex] ?? null;

  const resetSelfTestState = () => {
    setSelfTestStep('loading');
    setSelfTestCurrentIndex(0);
    setSelfTestAnswers([]);
    setSelfTestQuestions([]);
    setSelfTestError(null);
    setSelfTestResult(null);
    setSelfTestAnonymousUserId(null);
  };

  /**
   * 打开自测弹窗：创建匿名用户并加载对应专业问卷。
   */
  const openSelfTestModal = (majorName: string, majorCode: string) => {
    setSelfTestOpen(true);
    setSelfTestMajorName(majorName);
    setSelfTestMajorCode(majorCode);
    resetSelfTestState();
    setSelfTestBusy(true);

    const run = async () => {
      try {
        const createResponse = await fetch(ANONYMOUS_USERS_API_URL, { method: 'POST' });
        if (!createResponse.ok) {
          throw new Error(`创建匿名用户失败：${createResponse.status}`);
        }
        const createPayload = (await createResponse.json()) as unknown;
        const anonymousUserId = extractAnonymousUserId(createPayload);
        if (!anonymousUserId) {
          throw new Error('创建匿名用户失败：未返回有效用户ID');
        }

        const scalesResponse = await fetch(
          `https://ziquzixin.com/api/v1/kiosk/majors/${majorCode}/scales`
        );
        if (!scalesResponse.ok) {
          throw new Error(`获取问卷失败：${scalesResponse.status}`);
        }
        const scalesPayload = (await scalesResponse.json()) as unknown;
        const questions = extractScaleQuestions(scalesPayload);
        if (questions.length === 0) {
          throw new Error('当前专业暂未配置问卷题目');
        }

        setSelfTestAnonymousUserId(anonymousUserId);
        setSelfTestQuestions(questions);
        setSelfTestAnswers(Array.from({ length: questions.length }, () => null));
        setSelfTestStep('quiz');
      } catch (error) {
        setSelfTestError(error instanceof Error ? error.message : '问卷加载失败');
      } finally {
        setSelfTestBusy(false);
      }
    };
    void run();
  };

  /**
   * 关闭自测弹窗（不保留答题数据）。
   */
  const closeSelfTestModal = () => {
    setSelfTestOpen(false);
    resetSelfTestState();
  };

  /**
   * 记录当前题答案（score）。
   */
  const handleSelfTestAnswerSelect = (score: number) => {
    setSelfTestAnswers((prev) => {
      const next = [...prev];
      next[selfTestCurrentIndex] = score;
      return next;
    });
  };

  /**
   * 提交单题答案（点击“下一题/提交”时触发）。
   */
  const submitSelfTestAnswerAtIndex = async (index: number) => {
    if (!selfTestAnonymousUserId) {
      throw new Error('匿名用户无效，请关闭后重试');
    }
    if (!selfTestMajorCode) {
      throw new Error('专业编码缺失，请关闭后重试');
    }
    const question = selfTestQuestions[index];
    if (!question) {
      throw new Error('题目索引无效');
    }
    const score = selfTestAnswers[index];
    if (score === null) {
      throw new Error('请先选择本题答案后再继续');
    }

    const response = await fetch(ANONYMOUS_SCALE_ANSWERS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousUserId: selfTestAnonymousUserId,
        scaleId: question.scaleId,
        score
      })
    });
    if (!response.ok) {
      throw new Error(`提交问卷失败：${response.status}`);
    }
  };

  /**
   * 下一题 / 提交。
   */
  const handleSelfTestNext = async () => {
    if (selfTestStep !== 'quiz') {
      return;
    }
    if (currentSelfTestAnswer === null) {
      setSelfTestError('请先选择本题答案后再继续');
      return;
    }
    setSelfTestBusy(true);
    setSelfTestError(null);
    try {
      await submitSelfTestAnswerAtIndex(selfTestCurrentIndex);
      if (selfTestCurrentIndex >= selfTestTotal - 1) {
        if (selfTestAnswers.some((score) => score === null)) {
          throw new Error('还有未作答题目，请完成全部题目后再提交');
        }
        const resultResponse = await fetch(
          `https://ziquzixin.com/api/v1/kiosk/anonymous-users/${selfTestAnonymousUserId}/major-scores/${selfTestMajorCode}`
        );
        if (!resultResponse.ok) {
          throw new Error(`获取评估结果失败：${resultResponse.status}`);
        }
        const resultPayload = (await resultResponse.json()) as unknown;
        setSelfTestResult(extractMajorScoreResult(resultPayload));
        setSelfTestStep('result');
        return;
      }
      setSelfTestCurrentIndex((prev) => Math.min(prev + 1, selfTestTotal - 1));
    } catch (error) {
      setSelfTestError(error instanceof Error ? error.message : '提交问卷失败');
    } finally {
      setSelfTestBusy(false);
    }
  };

  /**
   * 选项文案展示：若后端已带 "A." 前缀则直接展示，避免重复。
   */
  const renderSelfTestOptionText = (option: KioskScaleQuestionOption) => {
    if (/^\s*[A-E]\./i.test(option.text)) {
      return option.text;
    }
    return `${option.key}. ${option.text}`;
  };

  const selfTestResultScore = Number(selfTestResult?.score ?? selfTestResult?.matchScore ?? 0);
  const selfTestLexueScore = Number(selfTestResult?.lexueScore ?? 0);
  const selfTestShanxueScore = Number(selfTestResult?.shanxueScore ?? 0);
  const selfTestYanxueDeduction = Number(selfTestResult?.yanxueDeduction ?? 0);
  const selfTestTiaozhanDeduction = Number(selfTestResult?.tiaozhanDeduction ?? 0);
  const selfTestMajorBrief = String(selfTestResult?.majorBrief ?? '暂无专业简介');

  return (
    <div className="kiosk-app-root" data-province-options={CHINA_PROVINCES.length}>
      {/* Background decorative elements */}
      <div className="kiosk-app-decor-cloud">
        <img src={imgDecorCloud} alt="cloud" className="kiosk-app-decor-img" />
      </div>

      <div className="kiosk-app-decor-leaf">
        <img src={imgDecorLeaf} alt="leaf" className="kiosk-app-decor-img" />
      </div>

      <div className="kiosk-app-decor-glow"></div>

      <div className="kiosk-app-main-row">
        {/* 左侧第 1 行：标题（右侧对应格留空，便于与下方卡片区对齐） */}
        <div className="kiosk-app-grid-intro">
          <div className="kiosk-app-intro">
            <h1 className="kiosk-app-title">新高考选科助手</h1>
            <p className="kiosk-app-subtitle">探索你的未来专业，从这里开始</p>
          </div>
        </div>

        {/* 左侧第 2 行：三张筛选卡片（高度即用户期望的「右侧空白区」参照） */}
        <div className="kiosk-app-grid-cards-column">
          {/* Province Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label">选择省份</label>
            <div
              className="kiosk-app-province-row"
              role="button"
              tabIndex={0}
              onClick={() => setProvinceModalOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setProvinceModalOpen(true);
                }
              }}
            >
              <span className="kiosk-app-province-text">{selectedProvince}</span>
              <i className="fas fa-map-marker-alt kiosk-app-icon-marker"></i>
            </div>
          </div>

          {/* First Subject Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label-spaced">首选科目（二选一）</label>
            <div className="kiosk-app-grid-2">
              {firstSubjectsOptions.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  className={`kiosk-app-btn-first-subject ${
                    subject === '物理'
                      ? firstSubject === subject
                        ? 'kiosk-app-btn-first-subject--physics-on'
                        : 'kiosk-app-btn-first-subject--physics-off'
                      : firstSubject === subject
                        ? 'kiosk-app-btn-first-subject--history-on'
                        : 'kiosk-app-btn-first-subject--history-off'
                  }`}
                  onClick={() => handleFirstSubjectClick(subject)}
                >
                  {subject}
                  {firstSubject === subject && (
                    <i className="fas fa-check ml-2 opacity-90"></i>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Second Subject Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label-spaced">次选科目（四选二）</label>
            <div className="kiosk-app-grid-2">
              {secondSubjectsOptions.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  className={`kiosk-app-btn-second-subject ${
                    secondSubjects.includes(subject)
                      ? 'kiosk-app-btn-second-subject--on'
                      : 'kiosk-app-btn-second-subject--off'
                  }`}
                  onClick={() => handleSecondSubjectToggle(subject)}
                >
                  {subject}
                  {secondSubjects.includes(subject) && (
                    <i className="fas fa-check ml-2 text-green-600"></i>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 左侧第 3 行：占位，把查询按钮顶到底部 */}
        <div className="kiosk-app-grid-spacer-left" aria-hidden />

        {/* 左侧第 4 行：查询按钮 */}
        <div className="kiosk-app-grid-search-wrap">
          <button type="button" className="kiosk-app-btn-search" onClick={handleSearch}>
            开始匹配查询
          </button>
        </div>

        {/* 右侧：未解锁时仅占用与「三张卡片」同行的网格行等高；解锁后向下延伸占满剩余主区域 */}
        <div
          className={`kiosk-app-right ${
            resultsUnlocked && !isSearching ? 'kiosk-app-right--expanded' : 'kiosk-app-right--compact'
          }`}
        >
          {/* 首次查询完成前不显示统计与 Tab；匹配中同样隐藏 */}
          {resultsUnlocked && !isSearching && (
            <>
              {/* 专业搜索：大屏触控、与统计卡同宽，基准 1920×1080 横向 16:9 */}
              <div className="kiosk-app-major-search">
                <div className="kiosk-app-major-search__inner">
                  <i className="fas fa-search kiosk-app-major-search__icon" aria-hidden />
                  <input
                    type="search"
                    value={majorQuery}
                    onChange={(event) => handleMajorQueryChange(event.target.value)}
                    placeholder="搜索专业名称..."
                    className="kiosk-app-major-search__input"
                    aria-label="搜索专业名称"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </div>
              </div>

              {/* Stats Overview */}
              <div className="kiosk-app-stats-row">
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-cyan">{totalMajors}</div>
                  <div className="kiosk-app-stat-caption">个大类</div>
                </div>
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-green">{totalSubCategories}</div>
                  <div className="kiosk-app-stat-caption">个小类</div>
                </div>
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-purple">{totalSpecialties}</div>
                  <div className="kiosk-app-stat-caption">个专业</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="kiosk-app-tabs-bar">
                {(['本科', '职业本科', '专科'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`kiosk-app-tab-btn ${activeTab === tab ? 'kiosk-app-tab-btn--active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setExpandedMajor(majorDataByTab[tab]?.[0]?.name ?? null);
                      const byIds = filterMajorCategoriesByIds(
                        majorDataByTab[tab] ?? [],
                        matchedIdSetByTab[tab]
                      );
                      setSearchExpandedNames(
                        getExpandedMajorNamesByQuery(byIds, majorQuery)
                      );
                    }}
                  >
                    {tab}
                    {activeTab === tab && <div className="kiosk-app-tab-underline"></div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 默认加载全部专业；加载中/报错/列表三态 */}
          <div className="kiosk-app-results-scroll">
            {isSearching || isMajorTreeLoading ? (
              <div className="kiosk-app-loading-wrap">
                <div className="kiosk-app-loading-emoji">☁️</div>
                <p className="kiosk-app-loading-text">正在加载专业数据...</p>
              </div>
            ) : majorTreeError ? (
              <div className="kiosk-app-results-filter-empty">
                <div className="kiosk-app-results-filter-empty__text">
                  专业数据加载失败：{majorTreeError}
                </div>
                <button
                  type="button"
                  className="kiosk-app-action-view mt-4"
                  onClick={() => void loadMajorTree(true)}
                >
                  点击重试
                </button>
              </div>
            ) : (
              <div className="kiosk-app-results-list">
                {filteredResults.length === 0 ? (
                  <div className="kiosk-app-results-filter-empty">
                    <p className="kiosk-app-results-filter-empty__text">
                      未找到匹配的专业，请尝试其他关键词
                    </p>
                  </div>
                ) : (
                  filteredResults.map((major) => (
                  <div key={major.name} className="kiosk-app-major-card">
                    <div
                      className="kiosk-app-major-header"
                      onClick={() => {
                        if (searchTrimmed.length > 0) {
                          setSearchExpandedNames((prev) =>
                            prev.includes(major.name)
                              ? prev.filter((n) => n !== major.name)
                              : [...prev, major.name]
                          );
                          return;
                        }
                        setExpandedMajor((prev) =>
                          prev === major.name ? null : major.name
                        );
                      }}
                    >
                      <h3 className="kiosk-app-major-title">{major.name}</h3>
                      <div className="kiosk-app-major-header-aside">
                        <span className="kiosk-app-major-meta">
                          {major.subCategories.length} 个小类
                        </span>
                        <i
                          className={`fas fa-chevron-down kiosk-app-chevron ${
                            isMajorRowExpanded(major.name) ? 'rotate-180' : ''
                          }`}
                        ></i>
                      </div>
                    </div>

                    {isMajorRowExpanded(major.name) && (
                      <div className="kiosk-app-major-divider">
                        {major.subCategories.map((subCategory) => (
                          <div key={subCategory.name} className="kiosk-app-subcategory-block">
                            <h4 className="kiosk-app-subcategory-title">{subCategory.name}</h4>
                            <div className="kiosk-app-major-rows">
                              {subCategory.majors.map((majorItem) => (
                                <div key={`${majorItem.id ?? majorItem.name}`} className="kiosk-app-major-row">
                                  <div className="kiosk-app-major-name">{majorItem.name}</div>
                                  <div className="kiosk-app-major-actions">
                                    <button className="kiosk-app-action-view">
                                      <i className="fas fa-eye mr-1"></i> 查看
                                    </button>
                                    <button
                                      className="kiosk-app-action-self"
                                      onClick={() => openSelfTestModal(majorItem.name, majorItem.code)}
                                    >
                                      <i className="fas fa-file-alt mr-1"></i> 自测
                                    </button>
                                    <button className="kiosk-app-action-school">
                                      <i className="fas fa-university mr-1"></i> 院校
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 选择省份对话框 */}
      {provinceModalOpen && (
        <div
          className="kiosk-province-overlay"
          role="presentation"
          onClick={() => setProvinceModalOpen(false)}
        >
          <div
            className="kiosk-province-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-province-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kiosk-province-dialog__head">
              <h2 id="kiosk-province-dialog-title" className="kiosk-province-dialog__title">
                选择省份
              </h2>
            </div>
            <div className="kiosk-province-dialog__body">
              <div className="kiosk-province-dialog__grid">
                {CHINA_PROVINCES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`kiosk-province-dialog__item ${
                      selectedProvince === name ? 'kiosk-province-dialog__item--active' : ''
                    }`}
                    onClick={() => {
                      setSelectedProvince(name);
                      setProvinceModalOpen(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="kiosk-province-dialog__foot">
              <button
                type="button"
                className="kiosk-province-dialog__cancel"
                onClick={() => setProvinceModalOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 选科校验友好提示弹框 */}
      {selectionAlertMessage && (
        <div
          className="kiosk-province-overlay"
          role="presentation"
          onClick={() => setSelectionAlertMessage(null)}
        >
          <div
            className="kiosk-province-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-selection-alert-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kiosk-province-dialog__head">
              <h2 id="kiosk-selection-alert-title" className="kiosk-province-dialog__title">
                温馨提示
              </h2>
            </div>
            <div className="kiosk-province-dialog__body">
              <p className="kiosk-app-results-filter-empty__text">{selectionAlertMessage}</p>
            </div>
            <div className="kiosk-province-dialog__foot">
              <button
                type="button"
                className="kiosk-province-dialog__cancel"
                onClick={() => setSelectionAlertMessage(null)}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 专业匹配度自评弹窗（43 寸触摸屏） */}
      {selfTestOpen && (
        <div className="kiosk-selftest-overlay" role="presentation" onClick={closeSelfTestModal}>
          <div
            className="kiosk-selftest-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-selftest-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="kiosk-selftest-close"
              aria-label="关闭自测弹窗"
              onClick={closeSelfTestModal}
            >
              ✕
            </button>

            {selfTestStep === 'loading' ? (
              <div className="kiosk-selftest-result">
                <h2 id="kiosk-selftest-title" className="kiosk-selftest-result__title">
                  {selfTestMajorName} - 专业匹配度自评
                </h2>
                <p className="kiosk-selftest-result__desc">
                  正在创建匿名用户并加载问卷，请稍候...
                </p>
              </div>
            ) : selfTestStep === 'quiz' ? (
              <div className="kiosk-selftest-layout">
                <div className="kiosk-selftest-left">
                  <div className="kiosk-selftest-progress-text">
                    {selfTestCurrentIndex + 1} / {selfTestTotal}
                  </div>
                  <h2 id="kiosk-selftest-title" className="kiosk-selftest-question-title">
                    {currentSelfTestQuestion?.title}
                  </h2>
                  <div className="kiosk-selftest-options">
                    {currentSelfTestQuestion?.options.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`kiosk-selftest-option ${
                          currentSelfTestAnswer === option.score ? 'kiosk-selftest-option--active' : ''
                        }`}
                        onClick={() => handleSelfTestAnswerSelect(option.score)}
                      >
                        <span className="kiosk-selftest-option__dot" aria-hidden />
                        <span className="kiosk-selftest-option__label">
                          {renderSelfTestOptionText(option)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="kiosk-selftest-right">
                  <h3 className="kiosk-selftest-right__title">答题进度</h3>
                  <div className="kiosk-selftest-right__bar">
                    <div
                      className="kiosk-selftest-right__bar-fill"
                      style={{
                        width: `${selfTestTotal === 0 ? 0 : ((selfTestCurrentIndex + 1) / selfTestTotal) * 100}%`
                      }}
                    />
                  </div>
                  <div className="kiosk-selftest-right__grid">
                    {selfTestQuestions.map((question, index) => (
                      <button
                        key={question.scaleId}
                        type="button"
                        className={`kiosk-selftest-right__dot ${
                          selfTestAnswers[index] ? 'kiosk-selftest-right__dot--done' : ''
                        } ${index === selfTestCurrentIndex ? 'kiosk-selftest-right__dot--current' : ''}`}
                        onClick={() => setSelfTestCurrentIndex(index)}
                        aria-label={`第${index + 1}题`}
                      />
                    ))}
                  </div>
                  <div className="kiosk-selftest-right__actions">
                    <button
                      type="button"
                      className="kiosk-selftest-btn kiosk-selftest-btn--prev"
                      onClick={() => setSelfTestCurrentIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={selfTestCurrentIndex === 0 || selfTestBusy}
                    >
                      上一题
                    </button>
                    <button
                      type="button"
                      className="kiosk-selftest-btn kiosk-selftest-btn--next"
                      onClick={handleSelfTestNext}
                      disabled={selfTestBusy}
                    >
                      {selfTestBusy
                        ? '提交中...'
                        : selfTestCurrentIndex === selfTestTotal - 1
                          ? '提交'
                          : '下一题'}
                    </button>
                  </div>
                  {selfTestError && (
                    <p className="kiosk-selftest-result__desc mt-4 !text-left !text-[1.25rem] !text-rose-600">
                      {selfTestError}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="kiosk-selftest-result">
                <div className="kiosk-selftest-result-page">
                  <div className="kiosk-selftest-result-page__header">
                    <div>
                      <h2 id="kiosk-selftest-title" className="kiosk-selftest-result-page__title">
                        你与{selfTestResult?.majorName ?? selfTestMajorName}专业匹配度测评结果
                      </h2>
                      <p className="kiosk-selftest-result-page__subtitle">
                        基于24题问卷的综合分析
                      </p>
                      <p className="kiosk-selftest-result-page__major-line">
                        {selfTestResult?.majorName ?? selfTestMajorName}
                      </p>
                      <p className="kiosk-selftest-result-page__match-line">
                        匹配度：{selfTestResultScore}%
                      </p>
                      <p className="kiosk-selftest-result-page__brief">{selfTestMajorBrief}</p>
                    </div>
                    <div className="kiosk-selftest-score-circle">
                      <span className="kiosk-selftest-score-circle__value">{selfTestResultScore}</span>
                      <span className="kiosk-selftest-score-circle__unit">分</span>
                    </div>
                  </div>

                  <div className="kiosk-selftest-result-page__body">
                    <div className="kiosk-selftest-result-page__left">
                      <div className="kiosk-selftest-dimension-grid">
                        <div className="kiosk-selftest-dimension-card kiosk-selftest-dimension-card--lexue">
                          <h3>乐学得分</h3>
                          <p className="kiosk-selftest-dimension-card__value">{selfTestLexueScore}分</p>
                          <p className="kiosk-selftest-dimension-card__desc">学习兴趣与投入度</p>
                          <div className="kiosk-selftest-dimension-card__bar">
                            <div
                              className="kiosk-selftest-dimension-card__fill"
                              style={{ width: `${Math.min(Math.abs(selfTestLexueScore), 50) * 2}%` }}
                            />
                          </div>
                        </div>
                        <div className="kiosk-selftest-dimension-card kiosk-selftest-dimension-card--shanxue">
                          <h3>善学得分</h3>
                          <p className="kiosk-selftest-dimension-card__value">{selfTestShanxueScore}分</p>
                          <p className="kiosk-selftest-dimension-card__desc">学习方法与能力表现</p>
                          <div className="kiosk-selftest-dimension-card__bar">
                            <div
                              className="kiosk-selftest-dimension-card__fill"
                              style={{ width: `${Math.min(Math.abs(selfTestShanxueScore), 50) * 2}%` }}
                            />
                          </div>
                        </div>
                        <div className="kiosk-selftest-dimension-card kiosk-selftest-dimension-card--yanxue">
                          <h3>厌学扣分</h3>
                          <p className="kiosk-selftest-dimension-card__value">{selfTestYanxueDeduction}分</p>
                          <p className="kiosk-selftest-dimension-card__desc">学习阻力与抵触倾向</p>
                          <div className="kiosk-selftest-dimension-card__bar">
                            <div
                              className="kiosk-selftest-dimension-card__fill"
                              style={{ width: `${Math.min(Math.abs(selfTestYanxueDeduction), 50) * 2}%` }}
                            />
                          </div>
                        </div>
                        <div className="kiosk-selftest-dimension-card kiosk-selftest-dimension-card--tiaozhan">
                          <h3>阻学扣分</h3>
                          <p className="kiosk-selftest-dimension-card__value">{selfTestTiaozhanDeduction}分</p>
                          <p className="kiosk-selftest-dimension-card__desc">挑战压力与外在阻碍</p>
                          <div className="kiosk-selftest-dimension-card__bar">
                            <div
                              className="kiosk-selftest-dimension-card__fill"
                              style={{ width: `${Math.min(Math.abs(selfTestTiaozhanDeduction), 50) * 2}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* <div className="kiosk-selftest-major-panel">
                        <h3 className="kiosk-selftest-major-panel__name">
                          {selfTestResult?.majorName ?? selfTestMajorName}
                        </h3>
                        <p className="kiosk-selftest-major-panel__score">已完成综合测评</p>
                      </div> */}
                    </div>

                    <div className="kiosk-selftest-result-page__qr">
                      <h3>查看完整168题报告</h3>
                      <div className="kiosk-selftest-qr-box">
                        <img src={imgQrcode} alt="查看完整报告二维码" className="kiosk-selftest-qr-box__qr" />
                        <img src={imgWeappLogo} alt="" className="kiosk-selftest-qr-box__logo" />
                      </div>
                      <p className="kiosk-selftest-result-page__qr-tip">
                        微信扫码查看详细报表、专业推荐与发展建议
                      </p>
                      <p className="kiosk-selftest-result-page__qr-foot">
                        扫码后报告将发送到你微信，设备端不留存任何数据
                      </p>
                    </div>
                  </div>

                  <p className="kiosk-selftest-result-page__privacy">
                    公共设备，关闭后结果不会保留
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
