/**
 * 新高考「3+1+2」模式下专业选科要求示例数据（演示用，非完整招生目录）。
 * 首选科目：物理或历史二选一；再选科目：化学、生物、政治、地理四选二。
 */

/** 首选科目类型 */
export type PreferredSubject = '物理' | '历史';

/** 再选科目（四选二范围内的科目） */
export type ElectiveSubject = '化学' | '生物' | '政治' | '地理';

/** 单个专业条目 */
export interface MajorRecord {
  /** 唯一标识 */
  id: string;
  /** 专业名称 */
  name: string;
  /** 学科门类 */
  discipline: string;
  /** 典型职业方向简述 */
  careerHint: string;
  /**
   * 首选科目要求：有值时须与考生首选一致；缺省表示「首选不限」。
   */
  preferred?: PreferredSubject;
  /**
   * 再选科目要求：多组「两门组合」满足其一即可；缺省或空数组表示再选不限。
   */
  electiveOptions?: [ElectiveSubject, ElectiveSubject][];
}

/**
 * 演示用专业库（节选常见门类，便于触屏终端展示）。
 */
export const MAJOR_DATABASE: MajorRecord[] = [
  {
    id: 'cs',
    name: '计算机科学与技术',
    discipline: '工学',
    careerHint: '软件开发、人工智能、网络安全等',
    preferred: '物理',
    electiveOptions: [['化学', '生物'], ['生物', '地理']],
  },
  {
    id: 'ee',
    name: '电气工程及其自动化',
    discipline: '工学',
    careerHint: '电力系统、自动化设备、新能源等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'civil',
    name: '土木工程',
    discipline: '工学',
    careerHint: '建筑设计、路桥工程、项目管理等',
    preferred: '物理',
  },
  {
    id: 'clinical',
    name: '临床医学',
    discipline: '医学',
    careerHint: '医院临床、医学研究等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'pharmacy',
    name: '药学',
    discipline: '医学',
    careerHint: '制药研发、药品监管、医院药学等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'nursing',
    name: '护理学',
    discipline: '医学',
    careerHint: '临床护理、社区护理、护理教育等',
    preferred: '物理',
    electiveOptions: [['化学', '生物'], ['生物', '政治']],
  },
  {
    id: 'math',
    name: '数学与应用数学',
    discipline: '理学',
    careerHint: '数据分析、金融工程、教学科研等',
    preferred: '物理',
  },
  {
    id: 'physics',
    name: '物理学',
    discipline: '理学',
    careerHint: '科研、光电、半导体等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'fin_eng',
    name: '金融工程',
    discipline: '经济学',
    careerHint: '量化投资、风险管理、金融科技等',
    preferred: '物理',
  },
  {
    id: 'econ',
    name: '经济学',
    discipline: '经济学',
    careerHint: '政策研究、企业分析、金融实务等',
  },
  {
    id: 'fin',
    name: '金融学',
    discipline: '经济学',
    careerHint: '银行、证券、保险、理财规划等',
  },
  {
    id: 'law',
    name: '法学',
    discipline: '法学',
    careerHint: '律师、法务、公务员、合规等',
    preferred: '历史',
    electiveOptions: [['政治', '地理']],
  },
  {
    id: 'chinese',
    name: '汉语言文学',
    discipline: '文学',
    careerHint: '编辑出版、文案策划、文化传媒等',
    preferred: '历史',
  },
  {
    id: 'news',
    name: '新闻学',
    discipline: '文学',
    careerHint: '新闻媒体、新媒体运营、公共关系等',
    preferred: '历史',
    electiveOptions: [['政治', '地理'], ['生物', '政治']],
  },
  {
    id: 'edu_chinese',
    name: '汉语言文学（师范）',
    discipline: '教育学',
    careerHint: '中小学语文教师等',
    preferred: '历史',
    electiveOptions: [['政治', '地理']],
  },
  {
    id: 'hist',
    name: '历史学',
    discipline: '历史学',
    careerHint: '文博、档案、教师、文化旅游等',
    preferred: '历史',
  },
  {
    id: 'phil',
    name: '哲学',
    discipline: '哲学',
    careerHint: '学术研究、智库、文化传媒等',
    preferred: '历史',
  },
  {
    id: 'poly_science',
    name: '政治学、经济学与哲学',
    discipline: '法学',
    careerHint: '公共事务、国际组织、学术等',
    preferred: '历史',
    electiveOptions: [['政治', '地理']],
  },
  {
    id: 'urban_planning',
    name: '城乡规划',
    discipline: '工学',
    careerHint: '规划设计、城市管理等',
    preferred: '物理',
    electiveOptions: [['地理', '生物']],
  },
  {
    id: 'env_sci',
    name: '环境科学',
    discipline: '工学',
    careerHint: '环保监测、环评、生态修复等',
    preferred: '物理',
    electiveOptions: [['化学', '生物'], ['化学', '地理']],
  },
  {
    id: 'materials',
    name: '材料科学与工程',
    discipline: '工学',
    careerHint: '新材料研发、半导体材料等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'bio_tech',
    name: '生物技术',
    discipline: '理学',
    careerHint: '生物医药、基因检测、科研等',
    preferred: '物理',
    electiveOptions: [['化学', '生物']],
  },
  {
    id: 'psy',
    name: '心理学',
    discipline: '理学',
    careerHint: '咨询、用户体验、人力资源等',
  },
  {
    id: 'foreign',
    name: '外国语言文学类',
    discipline: '文学',
    careerHint: '翻译、外贸、国际教育等',
  },
  {
    id: 'design',
    name: '视觉传达设计',
    discipline: '艺术学',
    careerHint: '品牌设计、UI、展览展示等',
  },
];

/**
 * 判断两门再选是否与某一组合一致（顺序无关）。
 */
function electivePairEquals(
  user: [ElectiveSubject, ElectiveSubject],
  option: [ElectiveSubject, ElectiveSubject],
): boolean {
  const a = new Set(user);
  return a.has(option[0]) && a.has(option[1]);
}

/**
 * 根据考生选科筛选匹配的专业列表。
 *
 * @param preferred 首选科目（物理或历史）
 * @param electives 再选两门科目
 * @returns 匹配的专业条目（按门类名称排序）
 */
export function filterMajorsBySelection(
  preferred: PreferredSubject,
  electives: [ElectiveSubject, ElectiveSubject],
): MajorRecord[] {
  const result = MAJOR_DATABASE.filter((major) => {
    if (major.preferred !== undefined && major.preferred !== preferred) {
      return false;
    }
    const opts = major.electiveOptions;
    if (!opts || opts.length === 0) {
      return true;
    }
    return opts.some((pair) => electivePairEquals(electives, pair));
  });
  return result.sort((x, y) => {
    const d = x.discipline.localeCompare(y.discipline, 'zh-CN');
    if (d !== 0) {
      return d;
    }
    return x.name.localeCompare(y.name, 'zh-CN');
  });
}

/**
 * 按学科门类分组（用于结果页统计展示）。
 */
export function groupByDiscipline(majors: MajorRecord[]): Map<string, MajorRecord[]> {
  const map = new Map<string, MajorRecord[]>();
  for (const m of majors) {
    const list = map.get(m.discipline);
    if (list) {
      list.push(m);
    } else {
      map.set(m.discipline, [m]);
    }
  }
  return map;
}
