import rawcaseStudies from './case-studies.json';
import rawmotionStudies from './motion.json';
import rawmediaAdditions from './media-additions.json';
import { withAssetBase } from '../lib/assetPath.js';
const caseStudies = withAssetBase(rawcaseStudies);
const motionStudies = withAssetBase(rawmotionStudies);
const mediaAdditions = withAssetBase(rawmediaAdditions);


// Supplied projects coexist with clearly marked slots for future work.
export const profile = {
  name: 'Elowen',
  title: '设计、动效与数字体验作品集。',
  intro: '这里展示我的完整课程项目、实习期间落地项目与动效探索。',
  email: '',
  resumeUrl: '',
};

export const districts = [
  { id: 'projects', number: '01', title: '完整课程项目', english: 'COURSE PROJECTS', kind: '从问题定义到完整方案', count: '06',
    description: '从一个问题出发，让想法长成完整的项目。', position: [-2, 0, -3], color: '#e8a8c8' },
  { id: 'web', number: '02', title: '实习期间落地项目', english: 'INTERNSHIP PROJECTS', kind: '真实需求中的设计实践', count: '06',
    description: '把真实需求，变成清晰、好用的网页体验。', position: [10, 0, 5], color: '#97c9cf' },
  { id: 'motion', number: '03', title: '动效设计', english: 'MOTION DESIGN', kind: 'Blender / C4D / Spline / TouchDesigner', count: String(motionStudies.length+1).padStart(2,'0'),
    description: '给形体一点时间，给想象一点生命。', position: [-6, 0, 5], color: '#d4c66f' },
];

const fullTitles = ['城市的另一种日常', '让灵感发生', '公共生活提案', '日常的再设计', '面向未来的想象', '把问题变成可能'];
const fullTags = ['服务与体验', '品牌与叙事', '空间与交互', '产品与系统', '社会与议题', '跨媒介探索'];
const webProjects = [
  { title: '东南大学物理学院', slug: 'web-physics', tag: '学院英文官网 / 网页设计' },
  { title: '东南大学自动化学院', slug: 'web-automation', tag: '学院英文官网 / 网页设计' },
  { title: '上海健康医学院健康治理研究院', slug: 'web-health-governance', tag: '研究院官网 / 网页设计' },
  { title: '南京机电职业技术学院信息工程学院', slug: 'web-nanjing-info', tag: '学院官网 / 网页设计' },
  { title: '南京林业大学现代分析测试中心', slug: 'web-nanjing-forestry', tag: '科研平台 / 网页设计' },
  { title: '黑龙江农业职业技术学院', slug: 'web-heilongjiang', tag: '高校官网 / 网页设计' },
];
const suppliedProjects = [
  { title: '咕咕岛', tag: '儿童呼吸训练 / 非遗转译', slug: 'gugu-island',
    description: '基于非遗泥咕咕的儿童呼吸训练与互动成长系统，将吹气互动、任务引导与游戏化界面结合，探索传统文化与儿童体验的连接。' },
  { title: 'GOODBOY', tag: '养宠责任教育 / SwiftUI App', slug: 'goodboy',
    description: '通过 30 天虚拟养犬体验，将喂养、清洁、训练等行为转化为每日互动任务，帮助用户在养宠前了解照护知识与责任。' },
  { title: '灵馥', tag: 'AI 合香 / 沉浸式体验', slug: 'lingfu',
    description: '基于 AI 合香与沉浸式体验的数字艺术疗愈体验系统，串联品牌 IP、移动端界面、合香硬件与 VR 场景。' },
  { title: '牙芽奇兵局', tag: '儿童口腔护理 / 智能交互', slug: 'yaya-rangers',
    description: '面向儿童口腔护理的智能交互系统，通过用户研究、需求分析与产品策略，串联智能牙刷、游戏化刷牙互动和 AI Agent 引导体验。' },
  { title: '昆曲韵动', tag: '昆曲文化 / 体感体验', slug: 'kunqu-rhythm',
    description: '以昆曲文化为主题的互动体验设计，从用户研究、服务系统与体验地图出发，展开手机端、电视端界面和文创设计。' },
  { title: '她视界', tag: '无障碍美妆 / 多感官交互', slug: 'her-view',
    description: '围绕视障女性的美妆体验，从用户研究、品牌视觉到智能化妆镜功能与交互方案，探索更独立的化妆体验。' },
];
export const projects = [
  ...fullTitles.map((title, i) => ({
    id: `project-${i + 1}`, number: `0${i + 1}`, title, district: 'projects', type: '完整课程项目', tag: fullTags[i],
    sample: true, description: '这里将呈现一个完整课程项目，从问题定义、调研洞察，到设计推导与最终呈现。',
    chapters: ['项目概览', '问题与洞察', '设计过程', '最终方案', '复盘与思考'],
    position: [-12.5 + i * 4.3, 0, -3.5], rotation: 0, model: 'gable-house', scale: 1.03,
    ...(suppliedProjects[i] ? { ...suppliedProjects[i], sample: false, caseStudy: caseStudies[suppliedProjects[i].slug] } : {}),
  })),
  ...[...motionStudies, {...mediaAdditions.tdPosters, tag:'动态海报 / 横竖双版 / 小组项目', description:'以古代车舆与移动方式为主题的小组课程项目，包含《行之所至》《器构舆轮》两组 TouchDesigner 动态海报，以及四张配套平面海报。'}].map((study,i)=>({
    id: study.id, number: String(i+1).padStart(2,'0'), title: study.title, district: 'motion', type: study.software, tag: study.tag||(study.clips.length>1?'4 段情绪主题 / 动效系列':'三维与动态视觉'), sample: false,
    description: study.description||(study.clips.length>1?'使用 Blender 制作的开合动画系列，包含开心、安慰、解压、平静四段作品。':`${study.software} 动效作品：${study.title}。`),
    media: study.clips, posters:study.posters, position: [-10.5+i*3.5,0,5], rotation: 0, model: 'atelier', scale: .92,
  })),
  ...webProjects.map((entry, i) => ({
    id: `web-${i + 1}`, number: `0${i + 1}`, title: entry.title, district: 'web', type: '实习期间落地项目', tag: entry.tag, sample: false, caseStudy: caseStudies[entry.slug],
    description: '实习期间独立完成的官网网页设计稿，呈现页面信息组织与视觉设计。',
    chapters: ['需求背景', '信息架构', '页面设计', '设计细节'],
    position: i < 3 ? [5 + i * 4.4, 0, 5.3] : [8 + (i - 3) * 4.7, 0, -8.3],
    rotation: 0, model: i === 1 ? 'pavilion' : 'gable-house', scale: i === 1 ? .77 : .91,
  })),
  { id:mediaAdditions.silentArchive.id, number:'01', title:mediaAdditions.silentArchive.title, district:'other', type:'智能光影设计', tag:'光影装置 / 影像记录', sample:false,
    description:'《缄默的存档》智能光影设计作品，包含装置展示片段与完整项目视频。', media:mediaAdditions.silentArchive.clips },
];

export const getProject = id => projects.find(project => project.id === id);
