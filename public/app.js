const runNowButton = document.querySelector("#runNow");
const refreshButton = document.querySelector("#refresh");
const recommendationsElement = document.querySelector("#recommendations");
const latestRunElement = document.querySelector("#latestRun");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatTime(value) {
  if (!value) return "尚未运行";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderRecommendations(payload) {
  latestRunElement.textContent = `最近运行：${formatTime(payload.latestRun)}`;
  const recommendations = payload.recommendations || [];
  if (!recommendations.length) {
    recommendationsElement.className = "empty";
    recommendationsElement.textContent = "暂无推荐结果。";
    return;
  }

  recommendationsElement.className = "";
  recommendationsElement.innerHTML = recommendations.map((item, index) => `
    <article class="recommendation">
      <div class="rank">${index + 1}</div>
      <div>
        <h3>${escapeHtml(item.fixtureZh || item.fixture)}</h3>
        <p class="fixture-original">${escapeHtml(item.fixture)}</p>
        <p><b>联赛：</b>${escapeHtml(item.leagueName || "未知赛事")}</p>
        <p><b>推荐：</b>${escapeHtml(item.pickZh || item.pick)}（${escapeHtml(item.confidence)}）</p>
        <p><b>理由：</b>${escapeHtml(item.reason)}</p>
        <div class="meta">${renderMeta(item)}</div>
      </div>
      <div class="score">${item.score}<small>分</small></div>
    </article>
  `).join("");
}

function renderMeta(item) {
  const parts = [];
  if (item.kickoffTargetText) parts.push(`北京时间 ${item.kickoffTargetText}`);
  if (item.kickoffSourceText && item.sourceTimeZone) parts.push(`当地时间 ${item.kickoffSourceText} ${item.sourceTimeZone}`);
  if (!item.kickoffTargetText && item.matchDate) parts.push(`比赛日期 ${item.matchDate}`);
  if (item.fixtureSourceCount) parts.push(`从 ${item.fixtureSourceCount} 个不同来源命中此场`);
  if (item.supportingSourceCount) parts.push(`${item.supportingSourceCount} 个来源支持该方向`);
  if (item.probabilities) {
    parts.push(`主胜 ${(item.probabilities.homeWin * 100).toFixed(1)}%`);
    parts.push(`平局 ${(item.probabilities.draw * 100).toFixed(1)}%`);
    parts.push(`客胜 ${(item.probabilities.awayWin * 100).toFixed(1)}%`);
  }
  parts.push(`来源：${(item.allSources || item.sources).join("、")}`);
  return escapeHtml(parts.join(" · "));
}

async function refreshRecommendations() {
  renderRecommendations(await api("/api/recommendations"));
}

runNowButton.addEventListener("click", async () => {
  runNowButton.disabled = true;
  runNowButton.textContent = "运行中...";
  try {
    const result = await api("/api/run", { method: "POST" });
    renderRecommendations({
      latestRun: result.latestRun,
      recommendations: result.recommendations
    });
  } catch (error) {
    recommendationsElement.className = "empty";
    recommendationsElement.textContent = `运行失败：${error.message}`;
  } finally {
    runNowButton.disabled = false;
    runNowButton.textContent = "立即运行";
  }
});

refreshButton.addEventListener("click", () => {
  refreshRecommendations().catch((error) => {
    recommendationsElement.className = "empty";
    recommendationsElement.textContent = `刷新失败：${error.message}`;
  });
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

refreshRecommendations().catch((error) => {
  recommendationsElement.className = "empty";
  recommendationsElement.textContent = `初始化失败：${error.message}`;
});
