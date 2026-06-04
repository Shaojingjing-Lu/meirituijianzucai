import { readFile } from "node:fs/promises";
import path from "node:path";

const targetTimeZone = "Asia/Shanghai";

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
  SP1: "西班牙甲级联赛",
  D1: "德国甲级联赛",
  I1: "意大利甲级联赛",
  F1: "法国甲级联赛"
};

const footballDataTimeZones = {
  E0: "Europe/London",
  SP1: "Europe/Madrid",
  D1: "Europe/Berlin",
  I1: "Europe/Rome",
  F1: "Europe/Paris"
};

const teamChineseNames = {
  Almeria: "阿尔梅里亚",
  "Ath Bilbao": "毕尔巴鄂竞技",
  "Aston Villa": "阿斯顿维拉",
  Augsburg: "奥格斯堡",
  Barcelona: "巴塞罗那",
  "Bayern Munich": "拜仁慕尼黑",
  Bolivia: "玻利维亚",
  Bournemouth: "伯恩茅斯",
  Brighton: "布莱顿",
  Burnley: "伯恩利",
  Castellon: "卡斯特利翁",
  Celta: "塞尔塔",
  Chelsea: "切尔西",
  "Crystal Palace": "水晶宫",
  Cyprus: "塞浦路斯",
  Dortmund: "多特蒙德",
  "Ein Frankfurt": "法兰克福",
  England: "英格兰",
  France: "法国",
  Freiburg: "弗赖堡",
  Fulham: "富勒姆",
  Getafe: "赫塔费",
  Girona: "赫罗纳",
  Greece: "希腊",
  Guinea: "几内亚",
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
  Scotland: "苏格兰",
  Sevilla: "塞维利亚",
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

export async function runAgent() {
  const sources = await loadSources();
  const results = await Promise.allSettled(sources.filter((source) => source.enabled !== false).map(collectSource));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return {
    latestRun: new Date().toISOString(),
    itemCount: items.length,
    recommendations: analyzeItems(items)
  };
}

async function loadSources() {
  const file = path.join(process.cwd(), "config", "default-sources.json");
  return JSON.parse(await readFile(file, "utf8"));
}

async function collectSource(source) {
  const text = await fetchText(source.url);
  if (source.type === "clubelo") return parseClubElo(text, source);
  if (source.type === "freesupertips") return parseFreeSuperTips(text, source);
  if (source.type === "football-data-odds") return parseFootballDataOdds(text, source);
  return [];
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "FootballRecommendationAgent/1.0 (+vercel)" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseClubElo(csv, source) {
  const rows = parseCsv(csv);
  const today = startOfDay(new Date());
  const latestDate = new Date(today);
  latestDate.setDate(latestDate.getDate() + 10);
  return rows
    .map((row) => clubEloRowToItem(row, source))
    .filter((item) => item && startOfDay(new Date(item.matchDate)) >= today && startOfDay(new Date(item.matchDate)) <= latestDate)
    .sort((left, right) => right.modelConfidence - left.modelConfidence)
    .slice(0, 30);
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
  const fixture = { home: row.Home, away: row.Away };
  const probabilityText = outcomes.map((outcome) => `${outcome.pick} ${(outcome.probability * 100).toFixed(1)}%`).join(" / ");
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 80),
    publishedAt: new Date().toISOString(),
    matchDate: row.Date,
    hasExactKickoffTime: false,
    leagueName: countryNames[row.Country] || row.Country || "未知赛事",
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick: best.pick,
    reason: `${row.Date} ${row.Country}：ClubElo 公开赛前概率为 ${probabilityText}`,
    modelConfidence: best.probability,
    probabilities: { homeWin, draw, awayWin }
  };
}

function parseFreeSuperTips(html, source) {
  const items = [];
  const pattern = /<time>([\s\S]*?)<\/time>[\s\S]{0,2500}?<div class="Leg__win">([\s\S]*?)<\/div><div class="Leg__lose">([\s\S]*?)<\/div>[\s\S]*?<div class="TipReason__body"><p>([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(pattern)) {
    const fixtureText = stripHtml(match[3]);
    const fixture = extractFixture(fixtureText);
    if (!fixture) continue;
    const pick = stripHtml(match[2]);
    const reason = stripHtml(match[4]);
    const matchDate = sourceLocalDate("Europe/London");
    const kickoff = buildKickoff(matchDate, stripHtml(match[1]), "Europe/London");
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceAuthority: Number(source.authority || 70),
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

function parseFootballDataOdds(csv, source) {
  const rows = parseCsv(csv);
  const today = startOfDay(new Date());
  const latestDate = new Date(today);
  latestDate.setDate(latestDate.getDate() + 30);
  return rows
    .map((row) => footballDataRowToItem(row, source))
    .filter((item) => item && startOfDay(new Date(item.matchDate)) >= today && startOfDay(new Date(item.matchDate)) <= latestDate)
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
  const fixture = { home: row.HomeTeam, away: row.AwayTeam };
  const matchDate = parseFootballDataDate(row.Date);
  const sourceTimeZone = footballDataTimeZones[row.Div] || "Europe/London";
  const kickoff = buildKickoff(matchDate, row.Time, sourceTimeZone);
  const probabilityText = outcomes.map((outcome) => `${outcome.pick} ${(outcome.probability * 100).toFixed(1)}%`).join(" / ");
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceAuthority: Number(source.authority || 80),
    publishedAt: new Date().toISOString(),
    leagueName: footballDataLeagueNames[row.Div] || row.Div || "未知联赛",
    matchDate,
    matchTime: row.Time,
    ...kickoff,
    fixture,
    fixtureKey: normalizeFixtureKey(fixture),
    pick: best.pick,
    reason: `${matchDate} ${row.Div || ""}：Football-Data 公开赔率隐含概率为 ${probabilityText}`,
    modelConfidence: best.probability,
    probabilities
  };
}

function analyzeItems(items) {
  const groups = new Map();
  for (const item of items.filter((entry) => entry.fixture && entry.fixtureKey && entry.pick)) {
    const group = groups.get(item.fixtureKey) || {
      fixture: item.fixture,
      picks: new Map(),
      sources: new Map(),
      reasons: [],
      newestAt: item.publishedAt,
      leagueName: item.leagueName,
      matchDate: item.matchDate,
      matchTime: item.matchTime,
      hasExactKickoffTime: item.hasExactKickoffTime === true,
      sourceTimeZone: item.sourceTimeZone,
      targetTimeZone: item.targetTimeZone,
      kickoffAtUtc: item.kickoffAtUtc,
      kickoffSourceText: item.kickoffSourceText,
      kickoffTargetText: item.kickoffTargetText,
      probabilities: item.probabilities
    };
    const pickGroup = group.picks.get(item.pick) || [];
    pickGroup.push(item);
    group.picks.set(item.pick, pickGroup);
    group.sources.set(item.sourceId, item.sourceName);
    group.reasons.push(item.reason);
    for (const key of ["leagueName", "matchDate", "matchTime", "sourceTimeZone", "targetTimeZone", "kickoffAtUtc", "kickoffSourceText", "kickoffTargetText"]) {
      if (item[key]) group[key] = item[key];
    }
    if (item.hasExactKickoffTime) group.hasExactKickoffTime = true;
    if (item.probabilities) group.probabilities = item.probabilities;
    groups.set(item.fixtureKey, group);
  }

  return [...groups.values()]
    .map(scoreGroup)
    .filter((recommendation) => recommendation.score >= 45 && recommendation.hasExactKickoffTime)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function scoreGroup(group) {
  const pickEntries = [...group.picks.entries()].sort((left, right) => right[1].length - left[1].length);
  const [pick, supporters] = pickEntries[0];
  const totalMentions = pickEntries.reduce((sum, [, entries]) => sum + entries.length, 0);
  const opponents = totalMentions - supporters.length;
  const supportingSources = new Map(supporters.map((item) => [item.sourceId, item.sourceName]));
  const avgAuthority = supporters.reduce((sum, item) => sum + item.sourceAuthority, 0) / supporters.length;
  const avgModelConfidence = supporters.reduce((sum, item) => sum + Number(item.modelConfidence || 0), 0) / supporters.length;
  const sourceConsistency = Math.min(30, (supporters.length / Math.max(totalMentions, 1)) * 30);
  const reasonQuality = Math.min(25, unique(group.reasons).length * 7 + supporters.length * 3 + (avgModelConfidence ? 8 : 0));
  const authority = Math.min(20, avgAuthority / 5);
  const modelConfidence = avgModelConfidence ? Math.min(20, Math.max(0, (avgModelConfidence - 0.36) * 90)) : 0;
  const conflictPenalty = Math.min(10, opponents * 4);
  const rawScore = avgModelConfidence
    ? Math.round(25 + avgModelConfidence * 100 + Math.min(8, avgAuthority / 10) - conflictPenalty)
    : Math.round(sourceConsistency + reasonQuality + 15 + authority + modelConfidence - conflictPenalty);
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    fixture: `${group.fixture.home} vs ${group.fixture.away}`,
    fixtureZh: `${teamNameZh(group.fixture.home)} vs ${teamNameZh(group.fixture.away)}`,
    homeTeam: group.fixture.home,
    awayTeam: group.fixture.away,
    homeTeamZh: teamNameZh(group.fixture.home),
    awayTeamZh: teamNameZh(group.fixture.away),
    leagueName: group.leagueName || "未知赛事",
    pick,
    pickZh: localizePick(pick, group.fixture),
    score,
    confidence: avgModelConfidence ? modelConfidenceLabel(avgModelConfidence, score) : score >= 80 ? "强烈推荐" : score >= 70 ? "值得关注" : score >= 60 ? "谨慎参考" : "低置信",
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
    probabilities: group.probabilities,
    reason: unique(group.reasons).slice(0, 3).join("；")
  };
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
  for (const character of line) {
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

function stripHtml(value = "") {
  return htmlDecode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
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

function extractFixture(text) {
  const match = text.match(/([\p{Script=Han}A-Za-z0-9 .·'-]{2,30})\s*(?:vs|VS|v|对阵|VS\.|－|-)\s*([\p{Script=Han}A-Za-z0-9 .·'-]{2,30})/u);
  if (!match) return null;
  return { home: cleanTeam(match[1]), away: cleanTeam(match[2]) };
}

function cleanTeam(value) {
  return value.replace(/\s*(推荐|预测|分析|前瞻|方向|比赛|看好|建议).*$/i, "").trim();
}

function normalizeFixtureKey(fixture) {
  return [fixture.home, fixture.away].map((team) => team.toLowerCase().replace(/[^\p{Script=Han}a-z0-9]/gu, "")).sort().join("_");
}

function buildKickoff(matchDate, matchTime, sourceTimeZone) {
  const kickoffDate = zonedTimeToDate(matchDate, matchTime, sourceTimeZone);
  if (!kickoffDate) return { hasExactKickoffTime: false };
  return {
    hasExactKickoffTime: true,
    sourceTimeZone,
    targetTimeZone,
    kickoffAtUtc: kickoffDate.toISOString(),
    kickoffSourceText: formatInTimeZone(kickoffDate, sourceTimeZone),
    kickoffTargetText: formatInTimeZone(kickoffDate, targetTimeZone)
  };
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
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0));
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

function sourceLocalDate(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function parseFootballDataDate(value) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return new Date().toISOString().slice(0, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  return { homeWin: home / total, draw: draw / total, awayWin: away / total };
}

function sumColumns(row, columns) {
  return columns.reduce((sum, column) => sum + Number(row[column] || 0), 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function inferLeagueName(fixture) {
  return nationalTeamNames.has(fixture.home) || nationalTeamNames.has(fixture.away) ? "国际赛" : "公开专家推荐";
}

function teamNameZh(teamName) {
  return teamChineseNames[teamName] || teamName;
}

function localizePick(pick, fixture) {
  if (pick === "平局") return "平局";
  if (/both teams to score/i.test(pick)) return "双方均进球";
  if (/over\s*2\.5/i.test(pick)) return "大 2.5 球";
  if (/under\s*3\.5/i.test(pick)) return "小 3.5 球";
  if (pick === `${fixture.home}胜`) return `${teamNameZh(fixture.home)}胜`;
  if (pick === `${fixture.away}胜`) return `${teamNameZh(fixture.away)}胜`;
  if (pick.startsWith(`${fixture.home} `)) return pick.replace(fixture.home, teamNameZh(fixture.home));
  if (pick.startsWith(`${fixture.away} `)) return pick.replace(fixture.away, teamNameZh(fixture.away));
  return pick;
}

function modelConfidenceLabel(probability, score) {
  if (probability >= 0.55 && score >= 80) return "强烈推荐";
  if (probability >= 0.44 && score >= 70) return "值得关注";
  if (probability >= 0.38 && score >= 60) return "谨慎参考";
  return "低置信";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
