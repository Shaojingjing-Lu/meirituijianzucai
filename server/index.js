import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const publicDir = path.join(rootDir, "public");
const sourcesFile = path.join(dataDir, "sources.json");
const stateFile = path.join(dataDir, "state.json");
const defaultSourcesFile = path.join(rootDir, "config", "default-sources.json");
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

const defaultState = {
  schedule: { enabled: true, time: "09:00" },
  push: { webhookUrls: [], enabled: false },
  latestRun: null,
  logs: [],
  items: [],
  recommendations: []
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const countryNames = {
  ESP: "西班牙赛事",
  ENG: "英格兰赛事",
  GER: "德国赛事",
  ITA: "意大利赛事",
  FRA: "法国赛事",
  NED: "荷兰赛事",
  POR: "葡萄牙赛事",
  SCO: "苏格兰赛事"
};

const footballDataLeagueNames = {
  E0: "英格兰超级联赛",
  E1: "英格兰冠军联赛",
  E2: "英格兰甲级联赛",
  E3: "英格兰乙级联赛",
  EC: "英格兰非联",
  SP1: "西班牙甲级联赛",
  SP2: "西班牙乙级联赛",
  D1: "德国甲级联赛",
  D2: "德国乙级联赛",
  I1: "意大利甲级联赛",
  I2: "意大利乙级联赛",
  F1: "法国甲级联赛",
  F2: "法国乙级联赛",
  N1: "荷兰甲级联赛",
  B1: "比利时甲级联赛",
  P1: "葡萄牙甲级联赛",
  T1: "土耳其超级联赛",
  G1: "希腊超级联赛",
  SC0: "苏格兰超级联赛",
  SC1: "苏格兰冠军联赛"
};

const footballDataTimeZones = {
  E0: "Europe/London",
  E1: "Europe/London",
  E2: "Europe/London",
  E3: "Europe/London",
  EC: "Europe/London",
  SP1: "Europe/Madrid",
  SP2: "Europe/Madrid",
  D1: "Europe/Berlin",
  D2: "Europe/Berlin",
  I1: "Europe/Rome",
  I2: "Europe/Rome",
  F1: "Europe/Paris",
  F2: "Europe/Paris",
  N1: "Europe/Amsterdam",
  B1: "Europe/Brussels",
  P1: "Europe/Lisbon",
  T1: "Europe/Istanbul",
  G1: "Europe/Athens",
  SC0: "Europe/London",
  SC1: "Europe/London"
};

const targetTimeZone = "Asia/Shanghai";

const teamChineseNames = {
  "Bolivia": "玻利维亚",
  "Scotland": "苏格兰",
  "Luxembourg": "卢森堡",
  "Gibraltar": "直布罗陀",
  "Kazakhstan": "哈萨克斯坦",
  "Armenia": "亚美尼亚",
  "Turkey": "土耳其",
  "Venezuela": "委内瑞拉",
  "Egypt": "埃及",
  "Brazil": "巴西",
  "El Salvador": "萨尔瓦多",
  "Qatar": "卡塔尔",
  "England": "英格兰",
  "Bosnia-Herzegovina": "波黑",
  "Panama": "巴拿马",
  "Switzerland": "瑞士",
  "Australia": "澳大利亚",
  "Kenya": "肯尼亚",
  "Palestine": "巴勒斯坦",
  "Tunisia": "突尼斯",
  "Belgium": "比利时",
  "Wales": "威尔士",
  "Romania": "罗马尼亚",
  "Germany": "德国",
  "USA": "美国",
  "Chile": "智利",
  "Portugal": "葡萄牙",
  Almeria: "阿尔梅里亚",
  "Ath Bilbao": "毕尔巴鄂竞技",
  "Aston Villa": "阿斯顿维拉",
  Augsburg: "奥格斯堡",
  Barcelona: "巴塞罗那",
  "Bayern Munich": "拜仁慕尼黑",
  Bournemouth: "伯恩茅斯",
  Brighton: "布莱顿",
  Burnley: "伯恩利",
  Castellon: "卡斯特利翁",
  Celta: "塞尔塔",
  Chelsea: "切尔西",
  "Crystal Palace": "水晶宫",
  Dortmund: "多特蒙德",
  "Ein Frankfurt": "法兰克福",
  Freiburg: "弗赖堡",
  Fulham: "富勒姆",
  Getafe: "赫塔费",
  Girona: "赫罗纳",
  Guinea: "几内亚",
  Bolivia: "玻利维亚",
  Cyprus: "塞浦路斯",
  England: "英格兰",
  France: "法国",
  Greece: "希腊",
  Heidenheim: "海登海姆",
  Hoffenheim: "霍芬海姆",
  Iraq: "伊拉克",
  "Ivory Coast": "科特迪瓦",
  "Las Palmas": "拉斯帕尔马斯",
  Leverkusen: "勒沃库森",
  Liverpool: "利物浦",
  Malaga: "马拉加",
  Mallorca: "马略卡",
  "Man City": "曼城",
  Newcastle: "纽卡斯尔联",
  "New Zealand": "新西兰",
  "Northern Ireland": "北爱尔兰",
  Oviedo: "奥维耶多",
  "RB Leipzig": "RB 莱比锡",
  Sevilla: "塞维利亚",
  Scotland: "苏格兰",
  Sociedad: "皇家社会",
  Spain: "西班牙",
  Slovenia: "斯洛文尼亚",
  "St Pauli": "圣保利",
  Stuttgart: "斯图加特",
  Sunderland: "桑德兰",
  Sweden: "瑞典",
  Tottenham: "热刺",
  "Union Berlin": "柏林联合",
  Valencia: "瓦伦西亚",
  Vallecano: "巴列卡诺",
  Villarreal: "比利亚雷亚尔",
  "Werder Bremen": "云达不莱梅",
  "West Ham": "西汉姆联",
  Wolfsburg: "沃尔夫斯堡",
  Wolves: "狼队"
};

const nationalTeamNames = new Set([
  "Bolivia",
  "Cyprus",
  "England",
  "France",
  "Greece",
  "Guinea",
  "Iraq",
  "Ivory Coast",
  "New Zealand",
  "Northern Ireland",
  "Scotland",
  "Slovenia",
  "Spain",
  "Sweden"
]);

async function ensureDataFiles() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(sourcesFile)) {
    const defaults = await readJson(defaultSourcesFile, []);
    await writeJson(sourcesFile, defaults);
  }
  if (!existsSync(stateFile)) {
    await writeJson(stateFile, defaultState);
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readState() {
  return { ...defaultState, ...(await readJson(stateFile, defaultState)) };
}

async function saveState(nextState) {
  await writeJson(stateFile, nextState);
}

async function addLog(level, message, detail = null) {
  const state = await readState();
  state.logs = [
    {
      id: crypto.randomUUID(),
      level,
      message,
      detail,
      time: new Date().toISOString()
    },
    ...(state.logs || [])
  ].slice(0, 120);
  await saveState(state);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}


function resolveSourceUrl(source) {
  if (source.type === "sogou-search") {
    const query = resolveDateTemplate(source.query || "今日足球推荐 竞彩 分析");
    return "https://www.sogou.com/web?query=" + encodeURIComponent(query) + "&ie=utf8";
  }
  if (source.type === "so-search") {
    const query = resolveDateTemplate(source.query || "今日足球推荐 竞彩 分析");
    return "https://m.so.com/s?q=" + encodeURIComponent(query);
  }
  const date = dateWithOffset(Number(source.dayOffset || 0));
  return source.url
    .replaceAll('{YYYY-MM-DD}', date)
    .replaceAll('{YYYYMMDD}', date.replaceAll('-', ''));
}

function resolveDateTemplate(template) {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: targetTimeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return String(template)
    .replaceAll('{YYYY年M月D日}', value.year + '年' + value.month + '月' + value.day + '日')
    .replaceAll('{YYYY-M-D}', value.year + '-' + value.month + '-' + value.day)
    .replaceAll('{WEEKDAY}', value.weekday || '今日');
}

function dateWithOffset(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: targetTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + '-' + value.month + '-' + value.day;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "FootballRecommendationAgent/1.0 (+local)"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function htmlDecode(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function plainTextFromHtml(html = "") {
  return htmlDecode(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return htmlDecode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function parseRss(xml, source) {
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return blocks.slice(0, 50).map((block) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 50),
    title: tagValue(block, "title"),
    content: [tagValue(block, "description"), tagValue(block, "summary"), tagValue(block, "content")].filter(Boolean).join(" "),
    link: tagValue(block, "link") || (block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? ""),
    publishedAt: parseDate(tagValue(block, "pubDate") || tagValue(block, "updated") || tagValue(block, "published"))
  }));
}

function parseDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function parsePage(text, source) {
  const title = stripHtml(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || source.name);
  const paragraphs = [...text.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((item) => item.length > 24)
    .slice(0, 20);
  return [{
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 50),
    title,
    content: paragraphs.join(" "),
    link: source.url,
    publishedAt: new Date().toISOString()
  }];
}

async function collectItems() {
  const sources = (await readJson(sourcesFile, [])).filter((source) => source.enabled !== false);
  const collected = [];
  for (const source of sources) {
    try {
      const text = await fetchText(resolveSourceUrl(source));
      const items = parseSource(text, source);
      collected.push(...items);
      await addLog("info", `已抓取 ${source.name}`, `${items.length} 条内容`);
    } catch (error) {
      await addLog("warn", `抓取失败：${source.name}`, error.message);
    }
  }
  return collected;
}

function parseSource(text, source) {
  if (source.type === "clubelo") return parseClubElo(text, source);
  if (source.type === "freesupertips") return parseFreeSuperTips(text, source);
  if (source.type === "yellowcard") return parseYellowCard(text, source);
  if (source.type === "sportsmole") return collectSportsMole(text, source);
  if (source.type === "sogou-search") return parseSogouSearch(text, source);
  if (source.type === "so-search") return parseSogouSearch(text, source);
  if (source.type === "sofascore") return parseSofaScore(text, source);
  if (source.type === "football-data-odds") return parseFootballDataOdds(text, source);
  if (source.type === "windrawwin") return parseWinDrawWin(text, source);
  if (source.type === "predictz") return parsePredictZ(text, source);
  if (source.type === "forebet") return parseForebet(text, source);
  if (source.type === "web") return parsePage(text, source);
  return parseRss(text, source);
}

function parseClubElo(csv, source) {
  const rows = parseCsv(csv);
  const today = startOfDay(new Date());
  const latestDate = new Date(today);
  latestDate.setDate(latestDate.getDate() + 10);

  return rows
    .map((row) => clubEloRowToItem(row, source))
    .filter((item) => {
      if (!item) return false;
      const matchDate = startOfDay(new Date(item.matchDate));
      return matchDate >= today && matchDate <= latestDate;
    })
    .sort((left, right) => right.modelConfidence - left.modelConfidence)
    .slice(0, 30);
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      insideQuote = !insideQuote;
    } else if (character === "," && !insideQuote) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

function clubEloRowToItem(row, source) {
  if (!row.Date || !row.Home || !row.Away) return null;
  const awayWin = sumColumns(row, ["GD<-5", "GD=-5", "GD=-4", "GD=-3", "GD=-2", "GD=-1"]);
  const draw = Number(row["GD=0"] || 0);
  const homeWin = sumColumns(row, ["GD=1", "GD=2", "GD=3", "GD=4", "GD=5", "GD>5"]);
  const outcomes = [
    { pick: `${row.Home}胜`, probability: homeWin },
    { pick: "平局", probability: draw },
    { pick: `${row.Away}胜`, probability: awayWin }
  ].sort((left, right) => right.probability - left.probability);
  const best = outcomes[0];
  if (!best || best.probability < 0.36) return null;
  if (best.probability > 0.70) return null;

  const fixture = { home: row.Home, away: row.Away };
  const probabilityText = outcomes.map((outcome) => `${outcome.pick} ${(outcome.probability * 100).toFixed(1)}%`).join(" / ");
  return {
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 80),
    title: `${row.Home} vs ${row.Away}`,
    content: probabilityText,
    link: source.url,
    publishedAt: new Date().toISOString(),
    matchDate: row.Date,
    hasExactKickoffTime: false,
    kickoffTimeNote: "ClubElo 公开接口仅提供比赛日期，未提供具体开球时间",
    leagueCode: row.Country,
    leagueName: countryNames[row.Country] || row.Country || "未知赛事",
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick: best.pick,
    reason: `${row.Date} ${row.Country}：ClubElo 公开赛前概率为 ${probabilityText}`,
    modelConfidence: best.probability,
    probabilities: {
      homeWin,
      draw,
      awayWin
    }
  };
}

function sumColumns(row, columns) {
  return columns.reduce((sum, column) => sum + Number(row[column] || 0), 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseFreeSuperTips(html, source) {
  const items = [];
  const cardPattern = /<time>([\s\S]*?)<\/time>[\s\S]{0,2500}?<div class="Leg__win">([\s\S]*?)<\/div><div class="Leg__lose">([\s\S]*?)<\/div>[\s\S]*?<div class="TipReason__body"><p>([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(cardPattern)) {
    const fixtureText = stripHtml(match[3]);
    const fixture = extractFixture(fixtureText);
    if (!fixture) continue;
    const pick = stripHtml(match[2]);
    const reason = stripHtml(match[4]);
    const matchDate = sourceLocalDate("Europe/London");
    const kickoff = buildKickoff(matchDate, stripHtml(match[1]), "Europe/London");
    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 70),
      title: fixtureText,
      content: `${pick}. ${reason}`,
      link: source.url,
      publishedAt: new Date().toISOString(),
      leagueName: inferLeagueName(fixture),
      matchDate,
      matchTime: stripHtml(match[1]),
      ...kickoff,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      reason: `${fixtureText}：${pick}。${reason}`
    });
  }
  return dedupeItems(items).slice(0, 20);
}


async function collectSportsMole(indexHtml, source) {
  const links = extractSportsMoleLinks(indexHtml).slice(0, 14);
  const results = await Promise.allSettled(links.map(async (url) => parseSportsMoleArticle(await fetchText(url), source, url)));
  return dedupeItems(results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []));
}

function extractSportsMoleLinks(html) {
  const links = [];
  for (const match of String(html).matchAll(/href=["']([^"']+prediction-team-news-lineups_[^"']+\.html)["']/gi)) {
    const url = match[1].startsWith('http') ? match[1] : 'https://www.sportsmole.co.uk' + match[1];
    if (!links.includes(url)) links.push(url);
  }
  return links;
}

function parseSportsMoleArticle(html, source, url) {
  const text = plainTextFromHtml(html);
  const title = text.match(/Preview:\s*([^\n]+?)\s+- prediction/i)?.[1] || '';
  const fixture = extractFixture(title);
  if (!fixture) return null;
  const prediction = text.match(/We say:\s*([\p{Script=Han}A-Za-z0-9 .·'’-]+?)\s+(\d+)s*-s*(\d+)\s+([\p{Script=Han}A-Za-z0-9 .·'’-]+?)(?=\s+[A-Z][a-z]|\s+For data|\s+Written by|$)/u);
  if (!prediction) return null;
  const homeGoals = Number(prediction[2]);
  const awayGoals = Number(prediction[3]);
  const pick = homeGoals > awayGoals ? fixture.home + '胜' : awayGoals > homeGoals ? fixture.away + '胜' : '平局';
  const sourceDate = text.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+202\d)\s+(\d{1,2})\.(\d{2})(am|pm)/)?.[1] || '';
  const matchDate = sourceDate ? parseEnglishArticleDate(sourceDate) : dateWithOffset(0);
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 74),
    publishedAt: new Date().toISOString(),
    leagueName: inferLeagueName(fixture),
    matchDate,
    hasExactKickoffTime: false,
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick,
    reason: 'Sports Mole 公开预测：' + fixture.home + ' vs ' + fixture.away + '，预测比分 ' + prediction[2] + '-' + prediction[3] + '。' + text.slice(text.indexOf('We say:'), text.indexOf('We say:') + 320),
    articleUrl: url
  };
}

function parseEnglishArticleDate(value) {
  const date = new Date(value + ' UTC');
  return Number.isNaN(date.getTime()) ? dateWithOffset(0) : date.toISOString().slice(0, 10);
}

function parseYellowCard(html, source) {
  const text = plainTextFromHtml(html);
  const items = [];
  const headerPattern = /(周[一二三四五六日天]\d{3})\s+([^\s]{2,16})\s+(\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(.{2,28}?)\s+vs\s+(.{2,28}?)(?=\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?|\s+展开完整信息|\s+主队)/gu;
  const headers = [...text.matchAll(headerPattern)];
  const seen = new Set();
  for (let index = 0; index < headers.length; index += 1) {
    const match = headers[index];
    const next = headers[index + 1];
    const context = text.slice(match.index + match[0].length, next ? next.index : Math.min(text.length, match.index + 2600)).replace(/\s+/g, ' ').trim();
    const fixture = { home: cleanTeam(match[5]), away: cleanTeam(match[6]) };
    const pick = extractYellowCardPick(context, fixture);
    if (!pick) continue;
    const matchDate = dateFromMonthDay(match[3]);
    const matchTime = normalizeChineseTime(match[4]);
    const kickoff = buildKickoff(matchDate, matchTime, targetTimeZone);
    const key = normalizeFixtureKey(fixture) + '|' + pick;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 68),
      publishedAt: new Date().toISOString(),
      leagueName: match[2],
      matchDate,
      matchTime,
      ...kickoff,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      reason: '黄牌吧公开模型：' + match[1] + ' ' + match[2] + ' ' + fixture.home + ' vs ' + fixture.away + '。' + compactReason(context)
    });
  }
  return dedupeItems(items).slice(0, 30);
}

function extractYellowCardPick(context, fixture) {
  const direction = context.match(/方向[:：]\s*([\p{Script=Han}A-Za-z0-9 .·'’-]{1,24}?)(?:\s|建议|稳胆|置信|支持点|$)/u)?.[1]
    || context.match(/模型主线([\p{Script=Han}A-Za-z0-9 .·'’-]{1,24}?)(?:[（(]|，|,|；|;|\s)/u)?.[1]
    || '';
  const value = direction.replace(/\s+/g, '').replace(/。.*$/, '');
  if (!value) return null;
  if (value.includes('平')) return '平局';
  if (value.includes(fixture.home) || /主胜|胜$/.test(value)) return fixture.home + '胜';
  if (value.includes(fixture.away) || /客胜|负$/.test(value)) return fixture.away + '胜';
  return value;
}

function compactReason(context) {
  return String(context || '')
    .replace(/展开完整信息[\s\S]*?专业结论/u, '')
    .replace(/支持点/g, ' 支持点')
    .replace(/风险点/g, ' 风险点')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260);
}

function dateFromMonthDay(monthDay) {
  const match = String(monthDay || '').match(/^(\d{2})-(\d{2})$/);
  if (!match) return dateWithOffset(0);
  const current = datePartsInTimeZone(new Date(), targetTimeZone).date;
  let year = Number(current.slice(0, 4));
  const candidate = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  const today = new Date(Date.UTC(year, Number(current.slice(5, 7)) - 1, Number(current.slice(8, 10))));
  if (candidate.getTime() < today.getTime() - 180 * 24 * 60 * 60 * 1000) year += 1;
  return year + '-' + match[1] + '-' + match[2];
}

function parseSogouSearch(html, source) {
  const text = plainTextFromHtml(html);
  if (/SourceVerifyCode|验证码用于确认|百度安全验证/.test(text)) return [];
  return parseChineseRecommendationText(text, source).slice(0, 25);
}

function parseChineseRecommendationText(text, source) {
  const items = [];
  const matchDate = dateWithOffset(0);
  const pattern = /(?:(英超|西甲|德甲|意甲|法甲|欧冠|欧联|亚冠|中超|日职|日乙|韩K|澳超|国际赛|世预赛|世界杯|友谊赛|巴西杯|挪超|瑞典超|美职|荷甲|葡超)[：:\s·-]{0,8})?([\p{Script=Han}A-Za-z0-9 .·'’-]{2,24})\s*(?:vs|VS|Vs|v|V|对阵)\s*([\p{Script=Han}A-Za-z0-9 .·'’-]{2,24})(?:[（(]?\s*(\d{1,2}:\d{2})\s*[）)]?)?/gu;
  const seen = new Set();
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(text.length, match.index + match[0].length + 280);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (!isFreshChineseSearchContext(context)) continue;
    const fixture = { home: cleanTeam(match[2]), away: cleanTeam(match[3]) };
    if (!isUsableChineseFixture(fixture)) continue;
    const pick = extractChinesePick(context, fixture);
    const matchTime = normalizeChineseTime(match[4] || extractChineseTime(context));
    if (!pick && !matchTime) continue;
    const kickoff = matchTime ? buildKickoff(matchDate, matchTime, targetTimeZone) : { hasExactKickoffTime: false };
    const key = [source.id, normalizeFixtureKey(fixture), pick || 'info', matchTime || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 60),
      publishedAt: new Date().toISOString(),
      leagueName: match[1] || inferChineseLeagueName(context),
      matchDate,
      matchTime,
      ...kickoff,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      infoOnly: !pick,
      reason: (pick ? '网页搜索公开摘要：' : '网页搜索赛程时间摘要：') + context.slice(0, 220)
    });
  }
  return dedupeItems(items);
}

function extractChinesePick(context, fixture) {
  const rules = [
    /(?:胜平负|方向|推荐|看法|参考|建议|竞彩)[:：\s]*(?:倾向|看好)?[:：\s]*(主胜|客胜|平局|主负|客不败|主不败|让胜|让平|让负|双平|胜|平|负)/u,
    /(?:推荐|方向|参考|建议)[:：\s]*(大\s*\d(?:\.\d)?|小\s*\d(?:\.\d)?|大球|小球|总进球\s*\d[、,，/]?\s*\d?)/u,
    /看好([\p{Script=Han}A-Za-z0-9 .·'’-]{2,20})(?:取胜|不败|赢球|方向)/u
  ];
  for (const rule of rules) {
    const match = context.match(rule);
    if (!match) continue;
    const value = match[1].replace(/\s+/g, '');
    if (/主胜|^胜$/.test(value)) return fixture.home + '胜';
    if (/客胜|主负|^负$/.test(value)) return fixture.away + '胜';
    if (/平局|^平$/.test(value)) return '平局';
    if (/主不败|双平/.test(value)) return fixture.home + '不败';
    if (/客不败/.test(value)) return fixture.away + '不败';
    if (/让胜|让平|让负|大球|小球/.test(value)) return value;
    if (/^大/.test(value)) return value.replace('大', '大 ');
    if (/^小/.test(value)) return value.replace('小', '小 ');
    if (value.includes(fixture.home)) return fixture.home + '胜';
    if (value.includes(fixture.away)) return fixture.away + '胜';
  }
  return null;
}

function extractChineseTime(context) {
  return context.match(/(?:开赛|比赛|时间|\()[:：\s]*(\d{1,2}:\d{2})/u)?.[1] || context.match(/\b(\d{1,2}:\d{2})\b/u)?.[1] || '';
}

function normalizeChineseTime(value = '') {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  return String(Number(match[1])).padStart(2, '0') + ':' + match[2];
}

function isUsableChineseFixture(fixture) {
  if (!fixture.home || !fixture.away) return false;
  if (fixture.home.length < 2 || fixture.away.length < 2) return false;
  if (fixture.home === fixture.away) return false;
  const bad = /搜索|推荐|分析|今日|大家|相关|全部|比赛|比分|竞彩|竟彩|足彩|足球|视频|结果|查询|网站|平台|即时|历史|赔率|数据|主队|客队|联赛|时间|来源|推荐您|参考|扫盘|计划|实单|网易|搜狐|腾讯|知乎|哔哩|www|http|.com|.cn|.net|202\d|\d{1,2}月\d{1,2}日/;
  const suspicious = /[：:：/\\]|^\d+$|^[A-Za-z]{1,2}$/;
  return !bad.test(fixture.home) && !bad.test(fixture.away) && !suspicious.test(fixture.home) && !suspicious.test(fixture.away);
}

function isFreshChineseSearchContext(context) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: targetTimeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = value.year;
  const month = value.month;
  const day = value.day;
  const freshTokens = [
    year + '年' + month + '月' + day + '日',
    year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
    year + '/' + month + '/' + day,
    month + '月' + day + '日',
    '小时前',
    '分钟前',
    '今天',
    '今日'
  ];
  if (!freshTokens.some((token) => context.includes(token))) return false;
  const dated = [...context.matchAll(/(202\d)[年/-](\d{1,2})[月/-](\d{1,2})/g)];
  return dated.every((match) => match[1] === year && Number(match[2]) === Number(month) && Math.abs(Number(match[3]) - Number(day)) <= 1);
}

function inferChineseLeagueName(context) {
  return context.match(/(英超|西甲|德甲|意甲|法甲|欧冠|欧联|亚冠|中超|日职|日乙|韩K|澳超|国际赛|世预赛|世界杯|友谊赛|巴西杯|挪超|瑞典超|美职|荷甲|葡超)/u)?.[1] || '网页搜索推荐';
}

function parseSofaScore(jsonText, source) {
  const payload = JSON.parse(jsonText);
  const now = Date.now();
  return (payload.events || [])
    .filter((event) => event?.homeTeam?.name && event?.awayTeam?.name && event.startTimestamp)
    .filter((event) => event.startTimestamp * 1000 >= now - 2 * 60 * 60 * 1000)
    .map((event) => {
      const kickoff = kickoffFromUnixSeconds(event.startTimestamp, 'UTC');
      const fixture = { home: event.homeTeam.name, away: event.awayTeam.name };
      const leagueName = [event.tournament?.name, event.category?.name].filter(Boolean).join(' · ') || 'SofaScore 赛程';
      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceAuthority: Number(source.authority || 70),
        publishedAt: new Date().toISOString(),
        leagueName,
        matchDate: kickoff.matchDate,
        matchTime: kickoff.matchTime,
        ...kickoff,
        fixture,
        fixtureKey: normalizeFixtureKey(fixture),
        infoOnly: true,
        reason: leagueName + '：SofaScore 公开赛程信息，' + fixture.home + ' vs ' + fixture.away
      };
    })
    .slice(0, 120);
}

function parseFootballDataOdds(csv, source) {
  const rows = parseCsv(csv);
  const today = startOfDay(new Date());
  const latestDate = new Date(today);
  latestDate.setDate(latestDate.getDate() + 30);

  return rows
    .map((row) => footballDataRowToItem(row, source))
    .filter((item) => {
      if (!item) return false;
      const matchDate = startOfDay(new Date(item.matchDate));
      return matchDate >= today && matchDate <= latestDate;
    })
    .sort((left, right) => right.modelConfidence - left.modelConfidence)
    .slice(0, 20);
}

function footballDataRowToItem(row, source) {
  if (!row.Date || !row.HomeTeam || !row.AwayTeam || row.FTR) return null;
  const odds = {
    home: firstNumber(row.AvgCH, row.AvgH, row.MaxCH, row.MaxH, row.B365CH, row.B365H),
    draw: firstNumber(row.AvgCD, row.AvgD, row.MaxCD, row.MaxD, row.B365CD, row.B365D),
    away: firstNumber(row.AvgCA, row.AvgA, row.MaxCA, row.MaxA, row.B365CA, row.B365A)
  };
  if (!odds.home || !odds.draw || !odds.away) return null;
  const probabilities = normalizeOdds(odds);
  const outcomes = [
    { pick: `${row.HomeTeam}胜`, probability: probabilities.homeWin },
    { pick: "平局", probability: probabilities.draw },
    { pick: `${row.AwayTeam}胜`, probability: probabilities.awayWin }
  ].sort((left, right) => right.probability - left.probability);
  const best = outcomes[0];
  if (!best || best.probability < 0.36) return null;
  if (best.probability > 0.70) return null;
  const fixture = { home: row.HomeTeam, away: row.AwayTeam };
  const matchDate = parseFootballDataDate(row.Date);
  const sourceTimeZone = footballDataTimeZones[row.Div] || "Europe/London";
  const kickoff = buildKickoff(matchDate, row.Time, sourceTimeZone);
  const probabilityText = outcomes.map((outcome) => `${outcome.pick} ${(outcome.probability * 100).toFixed(1)}%`).join(" / ");
  return {
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 80),
    title: `${row.HomeTeam} vs ${row.AwayTeam}`,
    content: probabilityText,
    link: source.url,
    publishedAt: new Date().toISOString(),
    matchDate,
    matchTime: row.Time,
    ...kickoff,
    leagueCode: row.Div,
    leagueName: footballDataLeagueNames[row.Div] || row.Div || "未知联赛",
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick: best.pick,
    reason: `${matchDate} ${row.Div || ""}：Football-Data 公开赔率隐含概率为 ${probabilityText}`,
    modelConfidence: best.probability,
    probabilities: {
      homeWin: probabilities.homeWin,
      draw: probabilities.draw,
      awayWin: probabilities.awayWin
    }
  };
}

function parseFootballDataDate(value) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return new Date().toISOString().slice(0, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function translateWdwTip(tip, fixture) {
  const t = String(tip || "").trim().toUpperCase().replace(/\s+/g, "");
  if (t === "1") return fixture.home + "胜";
  if (t === "2") return fixture.away + "胜";
  if (t === "X" || t === "D" || t === "DRAW") return "平局";
  if (t === "1X") return fixture.home + "不败";
  if (t === "X2") return fixture.away + "不败";
  if (t === "12") return "必有胜负";
  return null;
}

function parsePredictZ(html, source) {
  const items = [];
  const matchDate = sourceLocalDate("Europe/London");
  const rowPattern = /<tr[^>]*class="[^"]*pzpredrow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const row = rowMatch[1];
    const time = stripHtml(row.match(/class="[^"]*pztime[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");
    const league = stripHtml(row.match(/class="[^"]*pztournament[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");
    const home = cleanTeam(stripHtml(row.match(/class="[^"]*pzhometeam[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || ""));
    const away = cleanTeam(stripHtml(row.match(/class="[^"]*pzawayteam[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || ""));
    const tipRaw = stripHtml(row.match(/class="[^"]*pztip[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");
    if (!home || !away || home.length < 2 || away.length < 2) continue;
    const fixture = { home, away };
    const pick = translateWdwTip(tipRaw, fixture);
    const kickoff = buildKickoff(matchDate, time, "Europe/London");
    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 70),
      title: `${fixture.home} vs ${fixture.away}`,
      content: pick ? `推荐：${pick}` : "",
      link: source.url,
      publishedAt: new Date().toISOString(),
      leagueName: league || inferLeagueName(fixture),
      matchDate,
      matchTime: time,
      ...kickoff,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      reason: `PredictZ 公开预测：${fixture.home} vs ${fixture.away}，推荐 ${pick || tipRaw}`
    });
  }
  return dedupeItems(items).slice(0, 25);
}

function parseWinDrawWin(html, source) {
  const items = [];
  const matchDate = sourceLocalDate("Europe/London");
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripHtml(m[1]).trim());
    if (cells.length < 4) continue;
    const tipIndex = cells.findIndex((c) => /^[12X]{1,2}$/.test(c));
    if (tipIndex < 1) continue;
    const home = cleanTeam(cells[tipIndex - 1]);
    const away = cleanTeam(cells[tipIndex + 1] || "");
    if (!home || !away || home.length < 2 || away.length < 2 || home === away) continue;
    const timeCell = cells.find((c) => /^\d{1,2}:\d{2}$/.test(c)) || "";
    const leagueCell = cells[tipIndex + 2] || cells[tipIndex - 2] || "";
    const fixture = { home, away };
    const pick = translateWdwTip(cells[tipIndex], fixture);
    const kickoff = timeCell ? buildKickoff(matchDate, timeCell, "Europe/London") : { hasExactKickoffTime: false };
    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 71),
      title: `${fixture.home} vs ${fixture.away}`,
      content: pick ? `推荐：${pick}` : "",
      link: source.url,
      publishedAt: new Date().toISOString(),
      leagueName: leagueCell || inferLeagueName(fixture),
      matchDate,
      matchTime: timeCell,
      ...kickoff,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      reason: `WinDrawWin 公开预测：${fixture.home} vs ${fixture.away}，推荐 ${pick || cells[tipIndex]}`
    });
  }
  return dedupeItems(items).slice(0, 25);
}

function parseForebet(html, source) {
  const items = [];
  const matchDate = sourceLocalDate("Europe/Paris");
  const pattern = /class="[^"]*homeTeam[^"]*"[^>]*>[\s\S]{0,200}?<a[^>]*>([^<]+)<\/a>[\s\S]{0,1200}?class="[^"]*predict[^"]*en[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]{1,5}?)<\/span>[\s\S]{0,1200}?class="[^"]*awayTeam[^"]*"[^>]*>[\s\S]{0,200}?<a[^>]*>([^<]+)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const home = cleanTeam(match[1].trim());
    const tipRaw = match[2].trim();
    const away = cleanTeam(match[3].trim());
    if (!home || !away || home.length < 2 || away.length < 2) continue;
    const fixture = { home, away };
    const pick = translateWdwTip(tipRaw, fixture);
    if (!pick) continue;
    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 72),
      title: `${fixture.home} vs ${fixture.away}`,
      content: `推荐：${pick}`,
      link: source.url,
      publishedAt: new Date().toISOString(),
      leagueName: inferLeagueName(fixture),
      matchDate,
      hasExactKickoffTime: false,
      fixture,
      fixtureKey: normalizeFixtureKey(fixture),
      pick,
      reason: `Forebet 统计模型预测：${fixture.home} vs ${fixture.away}，推荐 ${pick}`
    });
  }
  return dedupeItems(items).slice(0, 25);
}

function sourceLocalDate(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function buildKickoff(matchDate, matchTime, sourceTimeZone) {
  const kickoffDate = zonedTimeToDate(matchDate, matchTime, sourceTimeZone);
  if (!kickoffDate) {
    return {
      hasExactKickoffTime: false,
      kickoffTimeNote: "来源未提供可解析的具体开球时间"
    };
  }

  return {
    hasExactKickoffTime: true,
    sourceTimeZone,
    targetTimeZone,
    kickoffAtUtc: kickoffDate.toISOString(),
    kickoffSourceText: formatInTimeZone(kickoffDate, sourceTimeZone),
    kickoffTargetText: formatInTimeZone(kickoffDate, targetTimeZone)
  };
}


function kickoffFromUnixSeconds(timestamp, sourceTimeZone) {
  const date = new Date(Number(timestamp) * 1000);
  const targetParts = datePartsInTimeZone(date, targetTimeZone);
  const sourceParts = datePartsInTimeZone(date, sourceTimeZone);
  return {
    hasExactKickoffTime: true,
    sourceTimeZone,
    targetTimeZone,
    kickoffAtUtc: date.toISOString(),
    kickoffSourceText: formatInTimeZone(date, sourceTimeZone),
    kickoffTargetText: formatInTimeZone(date, targetTimeZone),
    matchDate: targetParts.date,
    matchTime: targetParts.time,
    sourceMatchDate: sourceParts.date,
    sourceMatchTime: sourceParts.time
  };
}

function datePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: value.year + '-' + value.month + '-' + value.day, time: value.hour + ':' + value.minute };
}

function zonedTimeToDate(matchDate, matchTime, timeZone) {
  const dateMatch = String(matchDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(matchTime || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const firstGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const firstOffset = timeZoneOffsetMinutes(firstGuess, timeZone);
  const secondGuess = new Date(firstGuess.getTime() - firstOffset * 60_000);
  const secondOffset = timeZoneOffsetMinutes(secondGuess, timeZone);
  return new Date(firstGuess.getTime() - secondOffset * 60_000);
}

function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset"
  }).formatToParts(date);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function formatInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 1) return number;
  }
  return null;
}

function normalizeOdds(odds) {
  const home = 1 / odds.home;
  const draw = 1 / odds.draw;
  const away = 1 / odds.away;
  const total = home + draw + away;
  return {
    homeWin: home / total,
    draw: draw / total,
    awayWin: away / total
  };
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.fixtureKey}:${item.pick}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferLeagueName(fixture) {
  if (nationalTeamNames.has(fixture.home) || nationalTeamNames.has(fixture.away)) {
    return "国际赛";
  }
  return "公开专家推荐";
}

function extractRecommendation(item) {
  if (item.fixture && item.fixtureKey && item.pick) {
    return item;
  }
  const text = `${item.title} ${item.content}`;
  const fixture = extractFixture(text);
  if (!fixture) return null;
  const pick = extractPick(text, fixture);
  if (!pick) return null;
  return {
    ...item,
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick,
    reason: extractReason(text)
  };
}

function extractFixture(text) {
  const match = String(text || "").match(/([\p{Script=Han}A-Za-z0-9 .·'’-]{2,40})\s+(?:vs|VS|Vs|v|V)\s+([\p{Script=Han}A-Za-z0-9 .·'’-]{2,40})/u)
    || String(text || "").match(/([\p{Script=Han}A-Za-z0-9 .·'’-]{2,40})\s*(?:对阵|－|—|-)\s*([\p{Script=Han}A-Za-z0-9 .·'’-]{2,40})/u);
  if (!match) return null;
  return { home: cleanTeam(match[1]), away: cleanTeam(match[2]) };
}

function cleanTeam(value) {
  return String(value || "")
    .replace(/^[\s\S]{0,8}?(?:周[一二三四五六日天]\d{0,3}|竞彩足球|竞彩|足球|赛事|焦点|推荐|分析|预测|第\d+场)[:：\s-]*/u, "")
    .replace(/^(?:英超|西甲|德甲|意甲|法甲|欧冠|欧联|亚冠|中超|日职|日乙|韩K|澳超|国际赛|世预赛|世界杯|友谊赛|巴西杯|挪超|瑞典超|美职|荷甲|葡超)[:：\s-]*/u, "")
    .replace(/\s*(推荐|预测|分析|前瞻|方向|比赛|看好|建议|胜平负|比分|进球数).*$/i, "")
    .replace(/[()（）【】[\]{}]/g, "")
    .trim();
}

function normalizeFixtureKey(fixture) {
  return [fixture.home, fixture.away]
    .map((team) => team.toLowerCase().replace(/[^\p{Script=Han}a-z0-9]/gu, ""))
    .sort()
    .join("_");
}

function extractPick(text, fixture) {
  const lowerText = text.toLowerCase();
  const home = fixture.home;
  const away = fixture.away;
  if (/大\s*\d|大球|over/.test(lowerText)) return "大球";
  if (/小\s*\d|小球|under/.test(lowerText)) return "小球";
  if (new RegExp(`(?:看好|推荐|支持|建议|倾向|pick|back)[^。；,，]{0,18}${escapeRegExp(home)}`, "i").test(text)) return `${home}胜`;
  if (new RegExp(`${escapeRegExp(home)}[^。；,，]{0,18}(?:胜|赢|不败|主胜)`, "i").test(text)) return `${home}胜`;
  if (new RegExp(`(?:看好|推荐|支持|建议|倾向|pick|back)[^。；,，]{0,18}${escapeRegExp(away)}`, "i").test(text)) return `${away}胜`;
  if (new RegExp(`${escapeRegExp(away)}[^。；,，]{0,18}(?:胜|赢|不败|客胜)`, "i").test(text)) return `${away}胜`;
  if (/平局|draw|不败|双选|胜\/平|平\/负/.test(lowerText)) return "谨慎双选";
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractReason(text) {
  const sentences = text.split(/[。.!！；;]/).map((item) => item.trim()).filter(Boolean);
  const keywords = ["伤", "主场", "客场", "状态", "历史", "交锋", "阵容", "防线", "火力", "稳定", "支持", "数据"];
  return sentences.find((sentence) => keywords.some((keyword) => sentence.includes(keyword))) || sentences[0] || "多源观点聚合";
}

function summarizeSources(items) {
  const stats = new Map();
  for (const item of items) {
    const entry = stats.get(item.sourceId) || { sourceId: item.sourceId, sourceName: item.sourceName, itemCount: 0, recommendationItemCount: 0, infoOnlyCount: 0 };
    entry.itemCount += 1;
    if (item.pick) entry.recommendationItemCount += 1;
    if (!item.pick) entry.infoOnlyCount += 1;
    stats.set(item.sourceId, entry);
  }
  return [...stats.values()].sort((left, right) => right.itemCount - left.itemCount);
}

function previewCandidates(items) {
  return items.map((item) => ({
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    fixture: item.fixture ? item.fixture.home + ' vs ' + item.fixture.away : '',
    leagueName: item.leagueName,
    pick: item.pick || '',
    matchTime: item.matchTime || '',
    hasExactKickoffTime: item.hasExactKickoffTime === true,
    reason: String(item.reason || '').slice(0, 180)
  })).slice(0, 80);
}

function analyzeItems(items) {
  const normalizedItems = items.filter((entry) => entry.fixture && entry.fixtureKey);
  const extracted = items.map(extractRecommendation).filter(Boolean).filter((item) => isWinDrawLossPick(item.pick));
  const groups = new Map();
  for (const item of extracted) {
    const group = groups.get(item.fixtureKey) || {
      fixture: item.fixture,
      picks: new Map(),
      sources: new Map(),
      reasons: [],
      newestAt: item.publishedAt,
      leagueName: item.leagueName || null,
      leagueCode: item.leagueCode || null,
      matchDate: item.matchDate || null,
      matchTime: item.matchTime || null,
      hasExactKickoffTime: item.hasExactKickoffTime === true,
      sourceTimeZone: item.sourceTimeZone || null,
      targetTimeZone: item.targetTimeZone || targetTimeZone,
      kickoffAtUtc: item.kickoffAtUtc || null,
      kickoffSourceText: item.kickoffSourceText || null,
      kickoffTargetText: item.kickoffTargetText || null,
      kickoffTimeNote: item.kickoffTimeNote || null,
      probabilities: item.probabilities || null
    };
    const pickGroup = group.picks.get(item.pick) || [];
    pickGroup.push(item);
    group.picks.set(item.pick, pickGroup);
    group.sources.set(item.sourceId, item.sourceName);
    group.reasons.push(item.reason);
    if (item.leagueName) group.leagueName = item.leagueName;
    if (item.leagueCode) group.leagueCode = item.leagueCode;
    if (item.probabilities) group.probabilities = item.probabilities;
    if (item.matchDate) group.matchDate = item.matchDate;
    if (item.matchTime) group.matchTime = item.matchTime;
    if (item.hasExactKickoffTime) group.hasExactKickoffTime = true;
    if (item.sourceTimeZone) group.sourceTimeZone = item.sourceTimeZone;
    if (item.targetTimeZone) group.targetTimeZone = item.targetTimeZone;
    if (item.kickoffAtUtc) group.kickoffAtUtc = item.kickoffAtUtc;
    if (item.kickoffSourceText) group.kickoffSourceText = item.kickoffSourceText;
    if (item.kickoffTargetText) group.kickoffTargetText = item.kickoffTargetText;
    if (item.kickoffTimeNote) group.kickoffTimeNote = item.kickoffTimeNote;
    if (Date.parse(item.publishedAt) > Date.parse(group.newestAt)) {
      group.newestAt = item.publishedAt;
    }
    groups.set(item.fixtureKey, group);
  }
  for (const item of normalizedItems.filter((entry) => !entry.pick)) {
    const group = groups.get(item.fixtureKey);
    if (!group) continue;
    group.sources.set(item.sourceId, item.sourceName);
    group.reasons.push(item.reason);
    for (const key of ["leagueName", "matchDate", "matchTime", "sourceTimeZone", "targetTimeZone", "kickoffAtUtc", "kickoffSourceText", "kickoffTargetText"]) {
      if (item[key] && !group[key]) group[key] = item[key];
    }
    if (item.hasExactKickoffTime && !group.hasExactKickoffTime) group.hasExactKickoffTime = true;
  }

  return [...groups.values()]
    .map(scoreGroup)
    .filter((recommendation) => recommendation.score >= 45 && !isLowValueFavorite(recommendation))
    .sort((left, right) => (right.score + (right.hasExactKickoffTime ? 3 : 0)) - (left.score + (left.hasExactKickoffTime ? 3 : 0)))
    .slice(0, 3);
}

function isLowValueFavorite(recommendation) {
  const probs = recommendation.probabilities;
  if (!probs) return false;
  const pick = recommendation.pick || "";
  if (pick === `${recommendation.homeTeam}胜`) return Number(probs.homeWin || 0) > 0.70;
  if (pick === `${recommendation.awayTeam}胜`) return Number(probs.awayWin || 0) > 0.70;
  if (pick === "平局") return Number(probs.draw || 0) > 0.70;
  return false;
}

function scoreGroup(group) {
  const pickEntries = [...group.picks.entries()].sort((left, right) => right[1].length - left[1].length);
  const [pick, supporters] = pickEntries[0];
  const totalMentions = pickEntries.reduce((sum, [, items]) => sum + items.length, 0);
  const opponents = totalMentions - supporters.length;
  const supportingSources = new Map(supporters.map((item) => [item.sourceId, item.sourceName]));
  const avgAuthority = supporters.reduce((sum, item) => sum + item.sourceAuthority, 0) / supporters.length;
  const avgModelConfidence = supporters.reduce((sum, item) => sum + Number(item.modelConfidence || 0), 0) / supporters.length;
  const ageHours = Math.max(0, (Date.now() - Date.parse(group.newestAt)) / 36e5);
  const sourceConsistency = Math.min(30, (supporters.length / Math.max(totalMentions, 1)) * 30);
  const reasonQuality = Math.min(25, unique(group.reasons).length * 7 + supporters.length * 3 + (avgModelConfidence ? 8 : 0));
  const freshness = Math.max(4, 15 - Math.min(11, ageHours / 8));
  const authority = Math.min(20, avgAuthority / 5);
  const modelConfidence = avgModelConfidence ? Math.min(20, Math.max(0, (avgModelConfidence - 0.36) * 90)) : 0;
  const conflictPenalty = Math.min(10, opponents * 4);
  const score = avgModelConfidence
    ? Math.round(25 + avgModelConfidence * 100 + Math.min(8, avgAuthority / 10) - conflictPenalty)
    : Math.round(sourceConsistency + reasonQuality + freshness + authority + modelConfidence - conflictPenalty);
  const confidence = avgModelConfidence
    ? modelConfidenceLabel(avgModelConfidence, score)
    : score >= 80 ? "强烈推荐" : score >= 70 ? "值得关注" : score >= 60 ? "谨慎参考" : "低置信";

  return {
    id: crypto.randomUUID(),
    fixture: `${group.fixture.home} vs ${group.fixture.away}`,
    fixtureZh: `${teamNameZh(group.fixture.home)} vs ${teamNameZh(group.fixture.away)}`,
    fixtureDisplay: `${teamNameZh(group.fixture.home)} vs ${teamNameZh(group.fixture.away)}（${group.fixture.home} vs ${group.fixture.away}）`,
    homeTeam: group.fixture.home,
    awayTeam: group.fixture.away,
    homeTeamZh: teamNameZh(group.fixture.home),
    awayTeamZh: teamNameZh(group.fixture.away),
    leagueName: group.leagueName || "未知赛事",
    leagueCode: group.leagueCode,
    pick,
    pickZh: localizePick(pick, group.fixture),
    score: Math.max(0, Math.min(100, score)),
    confidence,
    supportCount: supporters.length,
    opposeCount: opponents,
    fixtureMentionCount: totalMentions,
    fixtureSourceCount: group.sources.size,
    supportingSourceCount: supportingSources.size,
    conflictingSourceCount: Math.max(0, group.sources.size - supportingSources.size),
    sources: supporters.map((item) => item.sourceName),
    allSources: [...group.sources.values()],
    matchDate: group.matchDate,
    matchTime: group.matchTime,
    hasExactKickoffTime: group.hasExactKickoffTime,
    sourceTimeZone: group.sourceTimeZone,
    targetTimeZone: group.targetTimeZone,
    kickoffAtUtc: group.kickoffAtUtc,
    kickoffSourceText: group.kickoffSourceText,
    kickoffTargetText: group.kickoffTargetText,
    kickoffTimeNote: group.kickoffTimeNote,
    probabilities: group.probabilities,
    reason: summarizeReasons(group.reasons),
    metrics: {
      sourceConsistency: Math.round(sourceConsistency),
      reasonQuality: Math.round(reasonQuality),
      freshness: Math.round(freshness),
      authority: Math.round(authority),
      modelConfidence: Math.round(modelConfidence),
      conflictPenalty
    }
  };
}

function teamNameZh(teamName) {
  return teamChineseNames[teamName] || teamName;
}

function isWinDrawLossPick(pick) {
  const value = String(pick || "").trim();
  if (!value) return false;
  if (/双方均进球|both teams to score|btts/i.test(value)) return false;
  if (/大\s*\d|小\s*\d|大球|小球|over|under|总进球|进球数/i.test(value)) return false;
  if (/比分|correct score|bet builder|串关|accumulator|角球|黄牌|first|anytime|scorer/i.test(value)) return false;
  if (value === "平局" || /平局$/.test(value)) return true;
  if (/胜$|不败$/.test(value)) return true;
  if (/^让[胜平负]/.test(value) || /让球|亚盘|受让|主不败|客不败|双选/.test(value)) return true;
  return false;
}

function localizePick(pick, fixture) {
  if (pick === "平局") return "平局";
  if (/不败/.test(pick)) return pick.replace(fixture.home, teamNameZh(fixture.home)).replace(fixture.away, teamNameZh(fixture.away));
  if (/^让[胜平负]$/.test(pick)) return pick;
  if (/^[大小]/.test(pick)) return pick;
  if (/both teams to score/i.test(pick)) return "双方均进球";
  if (/over\s*2\.5/i.test(pick)) return "大 2.5 球";
  if (/under\s*3\.5/i.test(pick)) return "小 3.5 球";
  if (pick === `${fixture.home}胜`) return `${teamNameZh(fixture.home)}胜`;
  if (pick === `${fixture.away}胜`) return `${teamNameZh(fixture.away)}胜`;
  if (pick.startsWith(`${fixture.home} `)) return pick.replace(fixture.home, teamNameZh(fixture.home));
  if (pick.startsWith(`${fixture.away} `)) return pick.replace(fixture.away, teamNameZh(fixture.away));
  return pick;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function modelConfidenceLabel(probability, score) {
  if (probability >= 0.55 && score >= 80) return "强烈推荐";
  if (probability >= 0.44 && score >= 70) return "值得关注";
  if (probability >= 0.38 && score >= 60) return "谨慎参考";
  return "低置信";
}

function summarizeReasons(reasons) {
  const cleanReasons = unique(reasons).slice(0, 3);
  return cleanReasons.join("；") || "多源观点一致，推荐方向较清晰";
}

async function runAgent() {
  await addLog("info", "开始执行足球推荐聚合任务");
  const items = await collectItems();
  const recommendations = analyzeItems(items);
  if (!recommendations.length) {
    await addLog("warn", "未生成真实推荐", "公开来源未返回可评分赛事，系统不会使用虚假或演示数据");
  }
  const state = await readState();
  state.items = items;
  state.recommendations = recommendations;
  state.latestRun = new Date().toISOString();
  await saveState(state);
  await addLog("info", "任务完成", `生成 ${recommendations.length} 条推荐`);
  await pushResults(recommendations);
  return { items, recommendations };
}

async function pushResults(recommendations) {
  const state = await readState();
  if (!state.push?.enabled || !state.push.webhookUrls?.length || !recommendations.length) return;
  for (const url of state.push.webhookUrls) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "足球推荐聚合 Agent",
          generatedAt: new Date().toISOString(),
          recommendations
        })
      });
      await addLog("info", "推送成功", url);
    } catch (error) {
      await addLog("warn", "推送失败", `${url}: ${error.message}`);
    }
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, time: new Date().toISOString() });
  }
  if (request.method === "GET" && url.pathname === "/api/sources") {
    return sendJson(response, 200, await readJson(sourcesFile, []));
  }
  if (request.method === "POST" && url.pathname === "/api/sources") {
    const body = await readBody(request);
    const sources = await readJson(sourcesFile, []);
    const nextSource = {
      id: body.id || crypto.randomUUID(),
      name: body.name,
      type: body.type || "rss",
      url: body.url,
      authority: Number(body.authority || 50),
      enabled: body.enabled !== false
    };
    if (!nextSource.name || !nextSource.url) {
      return sendJson(response, 400, { error: "name and url are required" });
    }
    await writeJson(sourcesFile, [nextSource, ...sources.filter((source) => source.id !== nextSource.id)]);
    return sendJson(response, 200, nextSource);
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/sources/")) {
    const sourceId = decodeURIComponent(url.pathname.split("/").pop());
    const sources = await readJson(sourcesFile, []);
    await writeJson(sourcesFile, sources.filter((source) => source.id !== sourceId));
    return sendJson(response, 200, { ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/items") {
    const state = await readState();
    return sendJson(response, 200, state.items || []);
  }
  if (request.method === "GET" && url.pathname === "/api/recommendations") {
    const state = await readState();
    return sendJson(response, 200, {
      latestRun: state.latestRun,
      recommendations: state.recommendations || []
    });
  }
  if (request.method === "GET" && url.pathname === "/api/logs") {
    const state = await readState();
    return sendJson(response, 200, state.logs || []);
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    const state = await readState();
    return sendJson(response, 200, {
      schedule: state.schedule,
      push: state.push
    });
  }
  if (request.method === "POST" && url.pathname === "/api/config") {
    const body = await readBody(request);
    const state = await readState();
    state.schedule = { ...state.schedule, ...(body.schedule || {}) };
    state.push = { ...state.push, ...(body.push || {}) };
    await saveState(state);
    return sendJson(response, 200, { schedule: state.schedule, push: state.push });
  }
  if (request.method === "POST" && url.pathname === "/api/run") {
    const result = await runAgent();
    return sendJson(response, 200, {
      latestRun: new Date().toISOString(),
      itemCount: result.items.length,
      recommendations: result.recommendations
    });
  }
  return sendJson(response, 404, { error: "Not found" });
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

function startScheduler() {
  let lastRunDay = "";
  setInterval(async () => {
    const state = await readState();
    if (!state.schedule?.enabled) return;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDay = now.toISOString().slice(0, 10);
    if (currentTime === state.schedule.time && lastRunDay !== currentDay) {
      lastRunDay = currentDay;
      runAgent().catch((error) => addLog("error", "定时任务失败", error.message));
    }
  }, 30_000);
}

await ensureDataFiles();
startScheduler();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      await serveStatic(request, response, url);
    }
  } catch (error) {
    await addLog("error", "服务异常", error.message);
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Football recommendation agent running at http://${host}:${port}`);
});
