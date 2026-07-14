const STORAGE_KEY = "nekoStudyLite";
const FOOTPRINT_KEY = "nekoFootprintsLite";

function loadItems() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function saveItems(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

function drawTree() {
  const canvas = document.getElementById("tree-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,300,300);

  const items = loadItems().filter(i => !i.archived);
  const count = items.length;

  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(140, 200, 20, 80);

  ctx.fillStyle = "#4caf50";
  for (let i=0; i<count; i++) {
    ctx.beginPath();
    ctx.arc(100 + Math.random()*100, 80 + Math.random()*120, 10, 0, Math.PI*2);
    ctx.fill();
  }
}

function loadFootprints() {
  const raw = localStorage.getItem(FOOTPRINT_KEY);
  const today = new Date().toISOString().slice(0,10);
  if (!raw) return { date: today, count: 0 };
  const data = JSON.parse(raw);
  return data.date === today ? data : { date: today, count: 0 };
}
function saveFootprints(count) {
  const today = new Date().toISOString().slice(0,10);
  localStorage.setItem(FOOTPRINT_KEY, JSON.stringify({ date: today, count }));
}
function renderFootprints() {
  const fp = loadFootprints();
  document.getElementById("footprints").textContent = "🐾".repeat(fp.count);
}

function clearForm() {
  document.getElementById("input-url").value = "";
  document.getElementById("input-title").value = "";
  document.getElementById("input-series").value = "";
  document.getElementById("input-tag").value = "";
  document.getElementById("input-total").value = "";
  document.getElementById("input-current").value = "";
  document.getElementById("input-note").value = "";
  document.getElementById("auto-tag-hint").textContent = "";
}

document.getElementById("input-url").addEventListener("change", () => {
  const url = document.getElementById("input-url").value.trim();
  if (!url) return;

  const autoTags = [];

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    autoTags.push("動画");

    fetch(`https://noembed.com/embed?url=${url}`)
      .then(r => r.json())
      .then(data => {
        if (data.title) document.getElementById("input-title").value = data.title;
        if (data.author_name) document.getElementById("input-series").value = data.author_name;
        if (data.duration) document.getElementById("input-total").value = Math.round(data.duration / 60);

        autoTags.push(...guessContentTags(data.title || ""));
        showAutoTags(autoTags);
      });

    return;
  }

  if (url.includes("note.com")) autoTags.push("記事");
  if (url.includes("nhk.or.jp")) autoTags.push("ニュース");
  if (url.includes("twitter.com") || url.includes("x.com") || url.includes("instagram.com")) autoTags.push("SNS");

  fetch(url)
    .then(r => r.text())
    .then(html => {
      const match = html.match(/<title>(.*?)<\/title>/i);
      if (match) {
        const title = match[1];
        document.getElementById("input-title").value = title;
        autoTags.push(...guessContentTags(title));
      }
      showAutoTags(autoTags);
    })
    .catch(()=>showAutoTags(autoTags));
});

function guessContentTags(text) {
  const t = text.toLowerCase();
  const tags = [];
  if (t.includes("健康") || t.includes("health")) tags.push("健康");
  if (t.includes("行動") || t.includes("behavior")) tags.push("行動");
  if (t.includes("多頭") || t.includes("multi")) tags.push("多頭");
  if (t.includes("防災") || t.includes("disaster")) tags.push("防災");
  if (t.includes("医療") || t.includes("medical")) tags.push("医療");
  if (t.includes("食事") || t.includes("food") || t.includes("ごはん")) tags.push("食事");
  if (t.includes("しつけ") || t.includes("training")) tags.push("しつけ");
  return tags;
}

function showAutoTags(tags) {
  const uniq = [...new Set(tags)].filter(Boolean);
  const hint = document.getElementById("auto-tag-hint");
  hint.textContent = uniq.length ? "自動タグ候補: " + uniq.join(", ") : "";
}

function toMMSS(value) {
  const m = Math.floor(value);
  const s = Math.round((value - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function addItem() {
  const url = document.getElementById("input-url").value.trim();
  const title = document.getElementById("input-title").value.trim();
  const series = document.getElementById("input-series").value.trim();
  const manualTag = document.getElementById("input-tag").value.trim();

  const totalRaw = document.getElementById("input-total").value.trim();
  let total;

  if (totalRaw.includes(":")) {
    const [m, s] = totalRaw.split(":").map(Number);
    total = m + (s / 60);
  } else {
    total = Number(totalRaw);
  }

  const currentRaw = document.getElementById("input-current").value.trim();
  let current = 0;

  if (currentRaw.includes(":")) {
    const [m, s] = currentRaw.split(":").map(Number);
    current = m + (s / 60);
  } else {
    current = Number(currentRaw || 0);
  }

  const note = document.getElementById("input-note").value.trim();

  if (!url && !title) {
    alert("URLかタイトルのどちらかは必要です");
    return;
  }
  if (!total) {
    alert("総量を入れておくと進捗が分かりやすくなります");
    return;
  }

  const autoHint = document.getElementById("auto-tag-hint").textContent.replace("自動タグ候補: ","");
  const autoTags = autoHint ? autoHint.split(",").map(t=>t.trim()).filter(Boolean) : [];

  const tags = [];
  if (manualTag) tags.push(manualTag);
  tags.push(...autoTags);

  const items = loadItems();
  const now = new Date().toISOString();

  items.push({
    id: Date.now(),
    url, title, series,
    tags,
    total, current, note,
    favorite: false,
    done: false,
    archived: false,
    createdAt: now,
    updatedAt: now
  });

  saveItems(items);

  const fp = loadFootprints();
  saveFootprints(fp.count + 1);

  clearForm();
  renderList();
  drawTree();
  renderFootprints();
}

function updateProgress(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);

  const raw = document.getElementById(`edit-${id}`).value.trim();
  let current;

  if (raw.includes(":")) {
    const [m, s] = raw.split(":").map(Number);
    current = m + (s / 60);
  } else {
    current = Number(raw || 0);
  }

  item.current = current;
  item.updatedAt = new Date().toISOString();

  saveItems(items);
  renderList();
}

function resetProgress(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);
  item.current = 0;
  saveItems(items);
  renderList();
}

function confirmDelete(id) {
  if (confirm("この学びを削除しますか？\n（アーカイブに移動されます）")) {
    archiveItem(id);
  }
}

function archiveItem(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);
  item.archived = true;
  saveItems(items);
  renderList();
  drawTree();
  renderFootprints();
}

function restoreItem(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);
  item.archived = false;
  saveItems(items);
  renderList();
}

function renderList() {
  const list = document.getElementById("list");
  const items = loadItems();

  const keyword = search.value.trim().toLowerCase();
  const sortType = sort.value;

  let filtered = items
    .filter(i => !i.archived)
    .filter(i => {
      const tagsText = (i.tags || []).join(" ").toLowerCase();
      return (i.title || "").toLowerCase().includes(keyword) ||
             (i.series || "").toLowerCase().includes(keyword) ||
             tagsText.includes(keyword);
    });

  if (sortType === "new") filtered.sort((a,b)=>b.id-a.id);
  if (sortType === "old") filtered.sort((a,b)=>a.id-b.id);
  if (sortType === "progress") filtered.sort((a,b)=>(b.current/b.total)-(a.current/a.total));

  list.innerHTML = "";

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.id = `item-${item.id}`;

    const progress = Math.round(item.current/item.total*100);
    const bg = item.done ? "#e8f5e9" : "#ffffff";
    card.style.background = bg;

    card.innerHTML = `
      <button class="delete-btn" onclick="confirmDelete(${item.id})">×</button>

      <div class="item-title">
        <a href="${item.url}" target="_blank">${item.title || "(タイトル未入力)"}</a>
      </div>

      ${item.series ? `<div>${item.series}</div>` : ""}

      <div class="tags-row">
        ${(item.tags || []).map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>

      <div class="progress-row">
        <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%;"></div></div>
        <div>${progress}%</div>
      </div>

      <div class="pos-row">
        <div class="pos-text">
          位置：${toMMSS(item.current)} / ${toMMSS(item.total)}
        </div>

        <input type="text" id="edit-${item.id}" value="${toMMSS(item.current)}" class="edit-pos">

        <button onclick="updateProgress(${item.id})">更新</button>
        <button onclick="resetProgress(${item.id})">リセット</button>
      </div>

      <div class="btn-row">
        <button onclick="toggleFavorite(${item.id})">${item.favorite ? "★お気に入り" : "☆お気に入り"}</button>
        <button onclick="toggleDone(${item.id})">${item.done ? "未完了に戻す" : "完了にする"}</button>
        <button onclick="editItem(${item.id})">編集</button>
      </div>
    `;

    list.appendChild(card);
  });
}

function toggleFavorite(id) {
  const items = loadItems();
  const item = items.find(i=>i.id===id);
  item.favorite = !item.favorite;
  saveItems(items);
  renderList();
}

function toggleDone(id) {
  const items = loadItems();
  const item = items.find(i=>i.id===id);
  item.done = !item.done;
  saveItems(items);
  renderList();
}

function editItem(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);

  const card = document.getElementById(`item-${id}`);

  card.innerHTML = `
    <div class="edit-row">
      <label>タイトル</label>
      <input id="edit-title-${id}" value="${item.title}" class="edit-input">
    </div>

    <div class="edit-row">
      <label>シリーズ</label>
      <input id="edit-series-${id}" value="${item.series || ""}" class="edit-input">
    </div>

    <div class="edit-row">
      <label>URL</label>
      <input id="edit-url-${id}" value="${item.url || ""}" class="edit-input">
    </div>

    <div class="edit-row">
      <label>総量</label>
      <input id="edit-total-${id}" value="${toMMSS(item.total)}" class="edit-input">
    </div>

    <div class="edit-row">
      <label>タグ（カンマ区切り）</label>
      <input id="edit-tags-${id}" value="${(item.tags || []).join(", ")}" class="edit-input">
    </div>

    <div class="edit-row">
      <label>メモ</label>
      <textarea id="edit-note-${id}" class="edit-textarea">${item.note || ""}</textarea>
    </div>

    <div class="edit-btn-row">
      <button class="edit-save-btn" onclick="saveEdit(${id})">保存</button>
      <button class="edit-cancel-btn" onclick="renderList()">キャンセル</button>

      ${item.archived
        ? `<button class="edit-restore-btn" onclick="restoreItem(${id})">復元</button>`
        : `<button class="edit-archive-btn" onclick="archiveItem(${id})">アーカイブ</button>`
      }
    </div>
  `;
}

function saveEdit(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);

  item.title = document.getElementById(`edit-title-${id}`).value.trim();
  item.series = document.getElementById(`edit-series-${id}`).value.trim();
  item.url = document.getElementById(`edit-url-${id}`).value.trim();

  const totalRaw = document.getElementById(`edit-total-${id}`).value.trim();
  if (totalRaw.includes(":")) {
    const [m, s] = totalRaw.split(":").map(Number);
    item.total = m + (s / 60);
  } else {
    item.total = Number(totalRaw);
  }

  const tagsRaw = document.getElementById(`edit-tags-${id}`).value.trim();
  item.tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()) : [];

  item.note = document.getElementById(`edit-note-${id}`).value.trim();

  saveItems(items);
  renderList();
}

function saveBackup() {
  const data = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "neko-manabi-lite-backup.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function loadBackup(file) {
  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);

      for (const key in data) {
        localStorage.setItem(key, data[key]);
      }

      alert("バックアップを復元しました！");
      location.reload();
    } catch (e) {
      alert("バックアップファイルが正しくありません");
    }
  };

  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  renderList();
  drawTree();
  renderFootprints();
});
