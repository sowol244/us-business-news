"use strict";

const sources = new Map([
  ["wsj", { name: "The Wall Street Journal", host: "wsj.com" }],
  ["nyt", { name: "The New York Times", host: "nytimes.com" }],
  ["washpost", { name: "The Washington Post", host: "washingtonpost.com" }],
  ["latimes", { name: "Los Angeles Times", host: "latimes.com" }],
  ["bloomberg", { name: "Bloomberg", host: "bloomberg.com" }],
  ["reuters", { name: "Reuters", host: "reuters.com" }],
  ["cnbc", { name: "CNBC", host: "cnbc.com" }],
  ["marketwatch", { name: "MarketWatch", host: "marketwatch.com" }],
  ["ft", { name: "Financial Times", host: "ft.com" }],
  ["ap", { name: "Associated Press", host: "apnews.com" }],
]);

const accessLabels = new Map([
  ["free", "무료 열람"],
  ["paywall", "구독 필요"],
  ["unknown", "유료 여부 미확인"],
]);

const verificationLabels = new Map([
  ["full", "본문 전체 확인"],
  ["partial", "공개 일부 확인"],
  ["headline", "제목·발행일 확인"],
]);

const newsTimeZone = "America/New_York";
const editionFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full", timeZone: "UTC" });
const easternDayFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: newsTimeZone,
});
const easternTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: newsTimeZone,
});

const editionSelect = document.querySelector("#edition-select");
const keywordSearch = document.querySelector("#keyword-search");
const publisherFields = document.querySelector("#publisher-fields");
const publisherOptions = document.querySelector("#publisher-options");
const publisherSelection = document.querySelector("#publisher-selection");
const clearPublishers = document.querySelector("#clear-publishers");
const editionTitle = document.querySelector("#edition-title");
const lastUpdate = document.querySelector("#last-update");
const updateTime = document.querySelector("#update-time");
const resultCount = document.querySelector("#result-count");
const notice = document.querySelector("#notice");
const noticeMessage = document.querySelector("#notice-message");
const retryButton = document.querySelector("#retry");
const articleList = document.querySelector("#article-list");
const articleTemplate = document.querySelector("#article-template");

let issues = new Map();
let updatedAt = null;
let articles = [];
let editionRequest;
let retry;

for (const [id, publisher] of sources) {
  const label = document.createElement("label");
  label.className = "publisher-option";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = id;
  label.append(checkbox, publisher.name);
  publisherOptions.append(label);
}

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(value) &&
    isDate(value.slice(0, 10));
}

function easternDate(value) {
  const parts = easternDayFormat.formatToParts(new Date(value));
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return [values.get("year"), values.get("month"), values.get("day")].join("-");
}

function isText(value, limit) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

function isPublisherUrl(value, host) {
  if (typeof value !== "string" || value.length > 1000) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.href === value && url.protocol === "https:" && !url.username && !url.password &&
      !url.port && !/[?#]/.test(value) && url.pathname !== "/" &&
      (url.hostname === host || url.hostname.endsWith("." + host));
  } catch {
    return false;
  }
}

function readIndex(data) {
  if (
    data?.schemaVersion !== 1 || data.timeZone !== newsTimeZone || !Array.isArray(data.issues) ||
    !(isTimestamp(data.updatedAt) || (data.updatedAt === null && data.issues.length === 0))
  ) {
    throw new Error("Invalid archive index");
  }
  const entries = new Map();
  let previousDate;
  for (const issue of data.issues) {
    if (
      !isDate(issue?.date) || (previousDate && issue.date >= previousDate) ||
      !Number.isSafeInteger(issue.articleCount) || issue.articleCount < 1
    ) {
      throw new Error("Invalid archive index entry");
    }
    entries.set(issue.date, issue.articleCount);
    previousDate = issue.date;
  }
  return entries;
}

function readEdition(data, date) {
  if (
    data?.schemaVersion !== 1 || data.kind !== "news" || data.date !== date ||
    !Array.isArray(data.articles) || data.articles.length !== issues.get(date)
  ) {
    throw new Error("Invalid daily edition");
  }
  const ids = new Set();
  for (const article of data.articles) {
    const source = sources.get(article?.source);
    if (
      !source || !isPublisherUrl(article.url, source.host) ||
      article.id !== article.source + ":" + article.url || ids.has(article.id) ||
      !isText(article.titleOriginal, 240) || !isText(article.titleKo, 180) ||
      !isTimestamp(article.publishedAt) || easternDate(article.publishedAt) !== date ||
      !isTimestamp(article.collectedAt) || article.collectedAt < article.publishedAt ||
      article.collectedAt > updatedAt ||
      !accessLabels.has(article.access) || !verificationLabels.has(article.verification) ||
      !Array.isArray(article.summaryKo) || article.summaryKo.length > 3 ||
      (article.verification === "headline" ? article.summaryKo.length !== 0 : article.summaryKo.length === 0) ||
      !article.summaryKo.every((point) => isText(point, 220))
    ) {
      throw new Error("Invalid article");
    }
    ids.add(article.id);
  }
  return data.articles;
}

async function fetchJson(path, signal) {
  const response = await fetch(path, { cache: "no-cache", signal });
  if (!response.ok) {
    throw new Error("Request failed (" + response.status + ")");
  }
  return response.json();
}

function showNotice(message, retryAction) {
  retry = retryAction;
  noticeMessage.textContent = message;
  notice.hidden = !message;
  retryButton.hidden = !retryAction;
}

function createCard(article) {
  const card = articleTemplate.content.firstElementChild.cloneNode(true);
  const date = card.querySelector(".article-date");
  const summary = card.querySelector(".article-summary");
  const access = card.querySelector(".access-badge");
  const link = card.querySelector(".original-link");

  card.querySelector(".article-source").textContent = sources.get(article.source).name;
  card.querySelector(".article-title").textContent = article.titleKo;
  card.querySelector(".original-title").textContent = article.titleOriginal;
  date.dateTime = article.publishedAt;
  date.textContent = "발행 " + easternTimeFormat.format(new Date(article.publishedAt));
  access.dataset.access = article.access;
  access.textContent = accessLabels.get(article.access);
  card.querySelector(".verification-badge").textContent = verificationLabels.get(article.verification);
  link.href = article.url;
  link.setAttribute("aria-label", "원문 보기 (새 탭) · " + article.titleKo);

  for (const point of article.summaryKo) {
    const bullet = document.createElement("li");
    bullet.textContent = point;
    summary.append(bullet);
  }
  summary.hidden = !article.summaryKo.length;
  card.querySelector(".headline-only").hidden = !!article.summaryKo.length;
  return card;
}

function searchText(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

function renderArticles() {
  const checked = publisherOptions.querySelectorAll("input:checked");
  const selection = new Set(Array.from(checked, (input) => input.value));
  const terms = searchText(keywordSearch.value).trim().split(/\s+/).filter(Boolean);
  const matching = articles.filter((article) => {
    if (selection.size && !selection.has(article.source)) {
      return false;
    }
    const searchable = searchText([
      article.titleKo, article.titleOriginal, sources.get(article.source).name, ...article.summaryKo,
    ].join(" "));
    return terms.every((term) => searchable.includes(term));
  });
  publisherSelection.textContent = selection.size ? selection.size + "곳 선택" : "전체";
  clearPublishers.disabled = !selection.size;
  articleList.replaceChildren(...matching.map(createCard));
  resultCount.textContent = selection.size || terms.length
    ? "전체 " + articles.length + "건 중 " + matching.length + "건"
    : "기사 " + matching.length + "건";
  showNotice(matching.length ? "" : "검색 조건에 맞는 기사가 없습니다.");
}

function setFiltersEnabled(enabled) {
  keywordSearch.disabled = !enabled;
  publisherFields.disabled = !enabled;
}

async function loadEdition(date) {
  editionRequest?.abort();
  const request = new AbortController();
  editionRequest = request;
  articleList.replaceChildren();
  articles = [];
  setFiltersEnabled(false);
  editionTitle.textContent = editionFormat.format(new Date(date));
  resultCount.textContent = "";
  showNotice("선택한 날짜의 기사를 불러오는 중입니다.");

  try {
    const edition = readEdition(await fetchJson("./data/" + date + ".json", request.signal), date);
    if (request.signal.aborted) {
      return;
    }
    articles = edition;
    setFiltersEnabled(true);
    renderArticles();
  } catch (error) {
    if (!request.signal.aborted) {
      console.error(error);
      showNotice("이 날짜의 기사를 불러오지 못했습니다.", () => loadIndex(date));
    }
  }
}

async function loadIndex(selectedDate) {
  editionSelect.disabled = true;
  editionSelect.replaceChildren(new Option("날짜 불러오는 중", ""));
  showNotice("기사 목록을 불러오는 중입니다.");
  try {
    const index = await fetchJson("./data/index.json");
    issues = readIndex(index);
    updatedAt = index.updatedAt;
    lastUpdate.hidden = updatedAt === null;
    if (updatedAt) {
      updateTime.dateTime = updatedAt;
      updateTime.textContent = easternTimeFormat.format(new Date(updatedAt));
    }
    if (!issues.size) {
      editionTitle.textContent = "기사 모음";
      editionSelect.replaceChildren(new Option("등록된 날짜 없음", ""));
      showNotice("아직 등록된 기사가 없습니다.");
      return;
    }
    editionSelect.replaceChildren(...Array.from(issues.keys(), (date) => new Option(date, date)));
    if (issues.has(selectedDate)) {
      editionSelect.value = selectedDate;
    }
    editionSelect.disabled = false;
    await loadEdition(editionSelect.value);
  } catch (error) {
    console.error(error);
    lastUpdate.hidden = true;
    editionSelect.replaceChildren(new Option("날짜를 불러오지 못함", ""));
    showNotice("뉴스 모음 날짜를 불러오지 못했습니다.", loadIndex);
  }
}

editionSelect.addEventListener("change", () => {
  if (issues.has(editionSelect.value)) {
    loadEdition(editionSelect.value);
  }
});
keywordSearch.addEventListener("input", renderArticles);
publisherOptions.addEventListener("change", renderArticles);
clearPublishers.addEventListener("click", () => {
  for (const input of publisherOptions.querySelectorAll("input:checked")) {
    input.checked = false;
  }
  publisherOptions.querySelector("input").focus();
  renderArticles();
});
retryButton.addEventListener("click", () => retry?.());
loadIndex();
