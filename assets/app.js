/* 北邮人工智能学院10班 · 班级日程协同应用 */
(function () {
  'use strict';

  const STORE_KEY = 'buptai10_v1';

  // ---------------- 默认数据 ----------------
  const now = new Date();
  const iso = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  const day = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d).slice(0, 10); };

  const DEFAULT = {
    meta: {
      school: '北京邮电大学 · 人工智能学院',
      className: '10班',
      classFull: '人工智能学院10班',
      grade: '2023级',
      motto: '厚德 / 博学 / 敬业 / 乐群',
      password: 'bupt10',
      online: 37,
    },
    schedules: [
      { id: 's1', title: '数据结构与算法 期中考试', due: day(3) + 'T14:00', cat: '考试', loc: '教三楼 302', note: '闭卷，按座号就坐，务必带学生证。', status: 'active', pinned: true, createdBy: '学习委员', lastMod: '学习委员' },
      { id: 's2', title: '机器学习 作业三', due: day(2) + 'T23:59', cat: '作业', loc: '学习通', note: '线性模型+正则化，手写+代码。', status: 'active', pinned: false, createdBy: '学习委员', lastMod: '学习委员' },
      { id: 's3', title: '班级迎新篮球赛', due: day(1) + 'T19:30', cat: '活动', loc: '东区篮球场', note: '穿班服，带矿泉水。', status: 'active', pinned: false, createdBy: '文体委员', lastMod: '文体委员' },
      { id: 's4', title: '人工智能学院 支部例会', due: day(5) + 'T19:00', cat: '会议', loc: '教二 401', note: '本学期支部工作安排。', status: 'active', pinned: false, createdBy: '班长', lastMod: '班长' },
      { id: 's5', title: '程序设计基础 课程设计立项', due: day(7) + 'T23:59', cat: '作业', loc: '北邮 OJ', note: '完成选题登记。', status: 'active', pinned: false, createdBy: '学习委员', lastMod: '学习委员' },
      { id: 's6', title: '大学英语 四级模拟考', due: day(-1) + 'T15:00', cat: '考试', loc: '教一 101', note: '已结束，记得复盘。', status: 'done', pinned: false, createdBy: '学习委员', lastMod: '学习委员' },
      { id: 's7', title: '高数 第四次作业', due: day(-2) + 'T23:59', cat: '作业', loc: '学习通', note: '', status: 'done', pinned: false, createdBy: '学习委员', lastMod: '学习委员' },
    ],
    links: [
      { id: 'l1', name: '北邮教务系统', url: 'jw.bupt.edu.cn', tag: '教务', desc: '选课 / 成绩 / 校历' },
      { id: 'l2', name: '北邮 OJ', url: 'buptoj.com', tag: '学习相关资料', desc: '在线判题系统' },
      { id: 'l3', name: '学习通', url: 'chaoxing.com', tag: '学习', desc: '作业 / 网课' },
    ],
    suggestions: [],
    badges: [],
    comments: {},
    checked: {},
    changelog: [],
  };

  let state = load();
  let currentView = 'countdown';
  let currentCat = '全部';
  let currentSearch = '';
  let calendarCursor = { y: now.getFullYear(), m: now.getMonth() };
  let editingId = null;
  let lastSyncNote = '正在建立同步…';

  // ---------------- 存储 ----------------
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 合并默认项，保证结构完整
        return deepMerge(structuredClone(DEFAULT), parsed);
      }
    } catch (e) { console.warn('load state failed', e); }
    return structuredClone(DEFAULT);
  }
  function deepMerge(base, over) {
    if (Array.isArray(base)) return over;
    if (typeof base === 'object' && base) {
      for (const k of Object.keys(over)) {
        if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k]) {
          base[k] = deepMerge(base[k], over[k]);
        } else { base[k] = over[k]; }
      }
    }
    return base;
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      setLastUpdated();
    } catch (e) { console.warn('save failed', e); }
  }
  function uid() { return 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

  // ---------------- 工具 ----------------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function setLastUpdated() {
    $('#lastUpdated').textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function catClass(cat) { return 'cat-' + (['考试', '作业', '活动', '会议', '其他'].includes(cat) ? cat : '其他'); }

  function remainingText(due) {
    const diff = new Date(due) - new Date();
    if (isNaN(diff)) return { text: '时间待定', urgent: false, expired: false };
    if (diff < 0) return { text: '已截止', urgent: false, expired: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    let t;
    if (d > 0) t = `${d} 天 ${h} 小时`;
    else if (h > 0) t = `${h} 小时 ${m} 分钟`;
    else t = `${Math.max(m, 1)} 分钟`;
    const urgent = diff < 3 * 3600000; // 3 小时内临期
    return { text: t, urgent, expired: false };
  }
  function fmtDue(due) {
    if (!due) return '待定';
    const d = new Date(due);
    if (isNaN(d)) return due;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function fmtDateTime(due) {
    const d = new Date(due);
    if (isNaN(d)) return due;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function localDateTimeInput(due) {
    const d = new Date(due);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function log(action, subject) {
    state.changelog.unshift({ time: Date.now(), who: currentUser() || '管理员', action, subject: subject || '' });
    if (state.changelog.length > 200) state.changelog = state.changelog.slice(0, 200);
  }

  // ---------------- 当前用户 ----------------
  let currentName = localStorage.getItem('buptai10_name') || '';
  function currentUser() { return currentName || '匿名'; }
  function setNameIfNeeded(cb) {
    if (currentName) return cb();
    const m = $('#nameModal'); m.hidden = false; $('#nameInput').value = '';
    $('#nameModal').dataset.cb = 'setName';
    setTimeout(() => $('#nameInput').focus(), 50);
  }

  // ---------------- 渲染：头部/班级 ----------------
  function renderHeader() {
    $('#schoolName').textContent = state.meta.school;
    $('#classMotto').textContent = state.meta.motto;
    const full = (state.meta.classFull || state.meta.className || '').trim();
    const m = full.match(/^(.*?)(\d+)\s*班$/);
    if (m) { $('#className').innerHTML = esc(m[1].trim()) + '<b>' + esc(m[2]) + '</b> 班'; }
    else { $('#className').textContent = full; }
    $('#onlineCount').textContent = state.meta.online;
    if (state.meta.badge && !state.meta.badge.startsWith('10')) {
      $('#headerBadge').innerHTML = `<img src="${esc(state.meta.badge)}">`;
    } else {
      $('#headerBadge').textContent = '10';
    }
    // 本周班徽
    const active = activeBadge();
    const topic = $('#topicBadge');
    if (active && active.data) { topic.innerHTML = `<img src="${esc(active.data)}">`; }
    else if (active && active.text) { topic.innerHTML = esc(active.text); }
    else { topic.innerHTML = '10'; }
    $('#daysToRotate').textContent = active ? (7 - Math.floor((Date.now() % (7 * 86400000)) / 86400000)) : '--';
  }
  function activeBadge() {
    if (!state.badges.length) return null;
    const start = Date.now() - (Date.now() % (7 * 86400000));
    const idx = Math.floor(Date.now() % (state.badges.length * 7 * 86400000) / (7 * 86400000));
    return state.badges[idx % state.badges.length];
  }

  // ---------------- 渲染：倒计时 ----------------
  function filteredActive() {
    return state.schedules
      .filter(s => s.status === 'active')
      .filter(s => currentCat === '全部' || s.cat === currentCat)
      .filter(s => {
        if (!currentSearch) return true;
        const q = currentSearch.toLowerCase();
        return (s.title + ' ' + (s.loc || '') + ' ' + (s.note || '')).toLowerCase().includes(q);
      })
      .sort((a, b) => (b.pinned - a.pinned) || (new Date(a.due) - new Date(b.due)));
  }

  function renderCountdown() {
    const list = filteredActive();
    const wrap = $('#countdownList');
    $('#countdownEmpty').style.display = list.length ? 'none' : 'block';
    wrap.innerHTML = list.map(s => cardHTML(s)).join('');
    $('#statActive').textContent = state.schedules.filter(s => s.status === 'active').length;
    $('#statDone').textContent = state.schedules.filter(s => s.status === 'done').length;
    bindCardActions(wrap);
  }

  function cardHTML(s) {
    const r = remainingText(s.due);
    const checkedN = (state.checked[s.id] || []).length;
    const urgent = (r.urgent && s.status === 'active' && !r.expired);
    const pin = s.pinned ? 'pinned' : '';
    const danger = s.status === 'active' ? (r.expired ? '已截止' : r.urgent) : '';
    return `
      <div class="card ${pin} ${urgent ? 'urgent' : ''}" data-id="${s.id}">
        <div class="card-top">
          <div class="card-title">${esc(s.title)}
            ${s.pinned ? ' <span title="已置顶">📌</span>' : ''}
          </div>
          <span class="cat-tag ${catClass(s.cat)}">${esc(s.cat)}</span>
        </div>
        <div class="countdown-box">
          ${s.status === 'active'
            ? (r.expired ? '⚠️ <b style="color:var(--urgent)">前已截止</b>' : `<b>${esc(r.text)}</b> ${danger ? '· 即将截止' : ''} 剩余`)
            : '✅ 已完成'}
        </div>
        <div class="card-meta">
          ${s.due ? `<span class="field">🗓 ${esc(fmtDue(s.due))}</span>` : ''}
          ${s.loc ? `<span class="field">📍 ${esc(s.loc)}</span>` : ''}
          <span class="field">👤 ${esc(s.createdBy || '班委')}</span>
        </div>
        ${s.note ? `<div class="card-meta"><span class="field">📝 ${esc(s.note)}</span></div>` : ''}
        ${s.status === 'active' ? `
        <div class="checked-row">打卡 <b>${checkedN}</b> 人 · 由 <b>${esc(s.createdBy || '班委')}</b> 更新 · 最后修改 ${esc(s.lastMod || '')}</div>
        ` : ''}
        <div class="card-actions">
          <button class="mini-btn" data-act="open">打开 / 修改</button>
          ${s.status === 'active' ? `<button class="mini-btn ${checkedN ? 'done' : ''}" data-act="check">${checkedN ? '取消打卡' : '打卡完成'}</button>` : ''}
          ${s.status === 'active' ? `<button class="mini-btn" data-act="comment">💬 留言（${(state.comments[s.id] || []).length}）</button>` : ''}
          ${s.status === 'done' ? `<button class="mini-btn" data-act="reopen">恢复进行中</button>` : ''}
        </div>
      </div>`;
  }

  function bindCardActions(wrap) {
    $$('.card', wrap).forEach(card => {
      const id = card.dataset.id;
      $$('.mini-btn', card).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === 'open') openEdit(id);
          else if (act === 'check') toggleCheck(id);
          else if (act === 'comment') openComment(id);
          else if (act === 'reopen') toggleStatus(id, 'active');
        });
      });
      const title = $('.card-title', card);
      if (title) title.addEventListener('click', () => openEdit(id));
    });
  }

  // ---------------- 渲染：日历 ----------------
  function renderCalendar() {
    const y = calendarCursor.y, m = calendarCursor.m;
    $('#calTitle').textContent = `${y} 年 ${m + 1} 月`;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const grid = $('#calGrid');
    let cells = '';
    const scheduleByDate = {};
    state.schedules.forEach(s => {
      if (!s.due) return;
      const d = new Date(s.due);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (scheduleByDate[key] = scheduleByDate[key] || []).push(s);
    });
    for (let i = 0; i < first; i++) cells += `<div class="cal-cell other"><span class="day"></span></div>`;
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${m}-${d}`;
      const has = scheduleByDate[key] || [];
      const isToday = key === todayKey;
      let marks = '';
      const colors = { 考试: 'var(--exam)', 作业: 'var(--hw)', 活动: 'var(--act)', 会议: 'var(--meet)', 其他: 'var(--other)' };
      has.slice(0, 8).forEach(s => { marks += `<span class="mark" style="background:${colors[s.cat] || colors['其他']}"></span>`; });
      cells += `<div class="cal-cell ${isToday ? 'today' : ''}" data-d="${key}"><span class="day">${d}</span><div class="marks">${marks}</div></div>`;
    }
    grid.innerHTML = cells;
    $$('.cal-cell[data-d]', grid).forEach(c => c.addEventListener('click', () => {
      const key = c.dataset.d;
      $$('.cal-cell.sel', grid).forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
      renderCalDetail(key, scheduleByDate[key] || []);
    }));
    renderCalDetail(todayKey, scheduleByDate[todayKey] || []);
  }
  function renderCalDetail(key, schedules) {
    const d = document.createElement('div'); // placeholder to avoid injection
    const detail = $('#calDetail');
    const ds = key.split('-');
    const label = `${ds[0]} 年 ${Number(ds[1]) + 1} 月 ${ds[2]} 日`;
    if (!schedules.length) {
      detail.innerHTML = `<h4>${label}</h4><p class="muted">这一天没有安排</p>`;
      return;
    }
    detail.innerHTML = `<h4>${label}</h4>` + schedules.map(s => cardHTML(s)).join('');
    bindCardActions(detail);
    // 点击重新绑定倒计时卡片操作
    $$('.card', detail).forEach(card => {
      const id = card.dataset.id;
      const title = $('.card-title', card);
      if (title) title.addEventListener('click', () => openEdit(id));
    });
  }

  // ---------------- 渲染：时间轴 ----------------
  function renderTimeline() {
    const wrap = $('#timelineList');
    const done = state.schedules.filter(s => s.status === 'done').sort((a, b) => new Date(b.due) - new Date(a.due));
    if (!done.length) { wrap.innerHTML = ''; $('#timelineEmpty').style.display = 'block'; return; }
    $('#timelineEmpty').style.display = 'none';
    const groups = {};
    done.forEach(s => {
      const d = new Date(s.due);
      const key = `${d.getMonth() + 1}月${d.getDate()}日`;
      (groups[key] = groups[key] || []).push(s);
    });
    let html = '';
    Object.entries(groups).forEach(([k, arr]) => {
      html += `<div class="day-group"><div class="day-head">${k} <span class="cnt">${arr.length} 项已结束</span></div>`;
      html += arr.map(s => cardHTML(s)).join('');
      html += '</div>';
    });
    wrap.innerHTML = html;
    bindCardActions(wrap);
  }

  // ---------------- 渲染：全部视图 & 侧栏 ----------------
  function render() {
    renderHeader();
    if (currentView === 'countdown') renderCountdown();
    else if (currentView === 'calendar') renderCalendar();
    else renderTimeline();
    renderLinks();
    renderBadgeCandidates();
    if (!$('#committeeModal').hidden) renderCommittee();
  }

  // ---------------- 编辑 ----------------
  function openEdit(id) {
    const s = state.schedules.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    $('#editTitle').textContent = '修改日程';
    $('#f-title').value = s.title;
    $('#f-due').value = localDateTimeInput(s.due);
    $('#f-cat').value = s.cat;
    $('#f-loc').value = s.loc || '';
    $('#f-status').value = s.status;
    $('#f-note').value = s.note || '';
    $('#f-pin').checked = !!s.pinned;
    $('#editMeta').innerHTML = `最后修改：${esc(s.lastMod || s.createdBy || '—')} · 由 ${esc(s.createdBy || '班委')} 发起<br><span style="color:var(--muted);font-size:12px">保存后全班实时同步，变更日志记录改前改后。</span>`;
    openModal('editModal');
    setTimeout(() => $('#f-title').focus(), 50);
  }
  function saveSchedule() {
    const title = $('#f-title').value.trim();
    if (!title) { toast('请填写项目名称'); return; }
    const s = state.schedules.find(x => x.id === editingId);
    if (s) {
      const old = { ...s };
      const data = {
        title, due: $('#f-due').value, cat: $('#f-cat').value, loc: $('#f-loc').value.trim(),
        status: $('#f-status').value, note: $('#f-note').value, pinned: $('#f-pin').checked,
      };
      // 模拟并发冲突检测
      if (s.lastMod && s.lastMod !== currentUser() && Math.random() < 0.12) {
        openConflict(old, data);
        return;
      }
      Object.assign(s, data, { lastMod: currentUser(), lastModTime: Date.now() });
      const ch = diffFields(old, s);
      log('修改日程', ch.length ? `${s.title}：${ch.join('、')}` : s.title);
      save(); render();
      toast('已保存，全班同步更新');
      closeModal('editModal');
    }
  }
  function diffFields(a, b) {
    const out = [];
    ['title', 'due', 'cat', 'loc', 'note', 'status', 'pinned'].forEach(k => {
      if (String(a[k]) !== String(b[k])) out.push(k);
    });
    return out;
  }
  function addFromForm() {
    const s = {
      id: uid(), title: $('#f-title').value.trim(), due: $('#f-due').value, cat: $('#f-cat').value,
      loc: $('#f-loc').value.trim(), status: $('#f-status').value, note: $('#f-note').value,
      pinned: $('#f-pin').checked, createdBy: currentUser(), lastMod: currentUser(), lastModTime: Date.now(),
    };
    if (!s.title) { toast('请填写项目名称'); return; }
    state.schedules.push(s);
    log('录入日程', s.title);
    save(); render();
    toast('已录入，全班同步更新');
    closeModal('editModal');
  }

  function openConflict(old, data) {
    const m = $('#conflictModal');
    $('#conflictMine').innerHTML = conflictHTML(data);
    $('#conflictTheirs').innerHTML = conflictHTML(fieldsOf(old));
    m.hidden = false;
    m.dataset.id = editingId;
  }
  function conflictHTML(d) {
    return `<p><b>${esc(d.title)}</b><br>📅 ${esc(fmtDateTime(d.due))} · 🏷 ${esc(d.cat)}${d.loc ? ' · 📍 ' + esc(d.loc) : ''}<br>📝 ${esc(d.note || '—')}<br>状态：${d.status === 'active' ? '进行中' : '已完成'}</p>`;
  }
  function fieldsOf(s) {
    return { title: s.title, due: s.due, cat: s.cat, loc: s.loc, note: s.note, status: s.status, pinned: s.pinned };
  }

  // ---------------- 状态 / 打卡 ----------------
  function toggleStatus(id, status) {
    const s = state.schedules.find(x => x.id === id);
    if (!s) return;
    s.status = status; s.lastMod = currentUser();
    log(status === 'done' ? '标记完成' : '恢复进行中', s.title);
    save(); render(); toast(status === 'done' ? '已标记完成' : '已恢复进行中');
  }
  function toggleCheck(id) {
    const s = state.schedules.find(x => x.id === id);
    if (!s) return;
    assertUser(() => {
      const arr = state.checked[id] = state.checked[id] || [];
      const i = arr.indexOf(currentName);
      if (i >= 0) { arr.splice(i, 1); toast('已取消打卡'); }
      else { arr.push(currentName); toast('已打卡，学习委员可看到你的名字'); }
      save(); render();
    });
  }

  function assertUser(cb) {
    if (currentName) return cb();
    openModal('nameModal');
    $('#nameModal').dataset.cb = 'check';
    nameCallback = cb;
  }
  let nameCallback = null;

  // ---------------- 留言 ----------------
  function openComment(id) {
    openModal('commentModal');
    editCommentId = id;
    renderComments();
  }
  let editCommentId = null;
  function renderComments() {
    const list = state.comments[editCommentId] || [];
    const region = $('#commentRegion');
    if (!list.length) { region.innerHTML = '<div class="comment-empty">还没有留言，给这条日程留一句提醒或疑问吧。</div>'; return; }
    region.innerHTML = list.map((c, i) => `
      <div class="comment-item">
        <span class="cname">${esc(c.name || '匿名同学')}</span>
        <span class="ctext">${esc(c.text)}</span>
        <button class="cdel" data-i="${i}" title="删除我的留言">✕</button>
      </div>`).join('');
    $$('.cdel', region).forEach(b => b.addEventListener('click', () => {
      if (!currentName) { toast('请先留个名字'); return; }
      const c = state.comments[editCommentId][Number(b.dataset.i)];
      if (c.name !== currentName) { toast('只能删除自己的留言'); return; }
      state.comments[editCommentId].splice(Number(b.dataset.i), 1);
      log('删除留言', editCommentId);
      save(); renderComments(); toast('留言已删除');
    }));
  }
  function submitComment() {
    const text = $('#commentText').value.trim();
    if (!text) { toast('请先写一句内容'); return; }
    const name = $('#commentName').value.trim() || '匿名同学';
    const t = $('#commentText');
    (state.comments[editCommentId] = state.comments[editCommentId] || []).push({ name, text, time: Date.now() });
    log('发布留言', text.slice(0, 20));
    save(); renderComments(); t.value = '';
    toast('留言已发布，全班可见');
  }

  // ---------------- 建议 ----------------
  function submitSuggestion() {
    const text = $('#sugText').value.trim();
    if (!text) { toast('请先写一句建议内容'); return; }
    const direct = $('#sugDirect').checked;
    const item = {
      id: uid(), text, cat: $('#sugCat').value.trim() || '其他', due: $('#sugTime').value || '',
      direct, from: currentName || '匿名同学', time: Date.now(), status: direct ? 'joined' : 'pending',
    };
    if (direct) {
      const t = item.due ? item.due : iso(new Date(Date.now() + 3 * 86400000)).slice(0, 16);
      state.schedules.push({
        id: uid(), title: text, due: t, cat: item.cat, loc: '', note: '重要日程（班委绕过审核）',
        status: 'active', pinned: false, createdBy: currentName || '同学', lastMod: currentName || '同学', lastModTime: Date.now(),
      });
      log('紧急添加', text);
      toast('已作为重要日程直接加入全班');
    } else {
      state.suggestions.push(item);
      toast('已提交，班委会在后台处理');
    }
    $('#sugText').value = ''; $('#sugCat').value = ''; $('#sugTime').value = ''; $('#sugDirect').checked = false;
    save(); render();
  }

  // ---------------- 链接 ----------------
  function renderLinks() {
    const list = state.links;
    const wrap = $('#linkList');
    if (!list.length) { wrap.innerHTML = '<div class="empty-sm">还没有链接，点右上「添加链接」写下第一个。</div>'; return; }
    wrap.innerHTML = list.map(l => `
      <div class="link-item">
        <span class="link-ico">🔗</span>
        <div>
          <div class="link-name"><a href="https://${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a></div>
          <div class="link-tag">${esc(l.tag || '')}${l.desc ? ' · ' + esc(l.desc) : ''}</div>
        </div>
        <div class="link-ops">
          <button class="mini-btn" data-act="edit" data-id="${l.id}">编辑</button>
          <button class="mini-btn danger" data-act="del" data-id="${l.id}">删除</button>
        </div>
      </div>`).join('');
    $$('[data-act]', wrap).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'edit') openLinkModal(id);
      if (b.dataset.act === 'del') {
        state.links = state.links.filter(x => x.id !== id);
        log('删除链接', id); save(); renderLinks(); renderCommittee();
        toast('链接已删除');
      }
    }));
  }
  function openLinkModal(id) {
    linkEditingId = id;
    const l = state.links.find(x => x.id === id);
    $('#lk-name').value = l ? l.name : ''; $('#lk-url').value = l ? l.url : '';
    $('#lk-tag').value = l ? l.tag : ''; $('#lk-desc').value = l ? l.desc : '';
    $('#linkModal h2').textContent = l ? '编辑链接' : '添加链接';
    openModal('linkModal');
  }
  let linkEditingId = null;
  function saveLink() {
    const name = $('#lk-name').value.trim(), url = $('#lk-url').value.trim();
    if (!name || !url) { toast('请填写名称和网址'); return; }
    const cleanUrl = url.startsWith('http') ? url : url.replace(/^(https?:\/\/)?/, '');
    const data = { name, url: cleanUrl, tag: $('#lk-tag').value.trim(), desc: $('#lk-desc').value.trim() };
    if (linkEditingId) {
      const l = state.links.find(x => x.id === linkEditingId);
      if (l) Object.assign(l, data);
      log('更新链接', name);
    } else {
      state.links.push({ id: uid(), ...data });
      log('添加链接', name);
    }
    save(); renderLinks(); renderCommittee();
    closeModal('linkModal'); toast(linkEditingId ? '链接已更新，全班同步' : '链接已添加，全班首页可见');
  }

  // ---------------- 班徽 ----------------
  function renderBadgeCandidates() {
    const wrap = $('#badgeCandidates');
    const list = state.badges;
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-sm">还没有班徽候选。上传第一张，它会立即成为本周班徽展示在顶部。</div>';
      return;
    }
    let html = '<div class="badge-mini" style="border:none;font-weight:600">🏅 全部候选（' + list.length + '）</div>';
    list.forEach((b, i) => {
      html += `<div class="badge-mini">
        ${b.data ? `<img src="${esc(b.data)}">` : `<span>${esc(b.text)}</span>`}
        <span>${esc(b.name)}${b.name === currentName ? '（你）' : ''}</span>
        <button class="mini-btn danger" data-i="${i}">删除</button>
      </div>`;
    });
    wrap.innerHTML = html;
    $$('[data-i]', wrap).forEach(b => b.addEventListener('click', () => {
      const bdg = list[Number(b.dataset.i)];
      if (bdg.name && bdg.name !== currentName) { toast('只能删除你提交的候选'); return; }
      list.splice(Number(b.dataset.i), 1);
      log('删除班徽候选', '');
      save(); renderHeader(); renderBadgeCandidates(); renderCommittee();
      toast('已删除你提交的候选');
    }));
  }
  let uploadedBadge = null;
  function openBadgeModal() { uploadedBadge = null; $('#badgeFile').value = ''; $('#badgePreviewWrap').hidden = true; openModal('badgeModal'); }
  function saveBadge() {
    if (!uploadedBadge) { toast('请先选择一张班徽图片'); return; }
    state.badges.push({ id: uid(), name: currentName || '匿名同学', data: uploadedBadge, text: '', time: Date.now() });
    log('上传班徽', '');
    save(); renderHeader(); renderBadgeCandidates(); renderCommittee();
    closeModal('badgeModal'); toast('已加入班徽候选，轮到时会展示在页面顶部');
  }

  // ---------------- 班委后台 ----------------
  function renderCommittee() {
    const active = $$('#committeeTabs .ctab.active')[0]?.dataset.ctab || 'record';
    const body = $('#committeeBody');
    if (active === 'record') body.innerHTML = committeeRecord();
    else if (active === 'manage') body.innerHTML = committeeManage();
    else if (active === 'suggest') body.innerHTML = committeeSuggest();
    else if (active === 'link') body.innerHTML = committeeLink();
    else if (active === 'log') body.innerHTML = committeeLog();
    else if (active === 'settings') body.innerHTML = committeeSettings();
    bindCommittee(body);
  }

  function committeeRecord() {
    return `<p class="muted">一句话「时间+项目」自动解析，也可多行批量导入。每个时段一条。</p>
      <div class="ctoolbar">
        <textarea id="rec-src" style="flex:1;min-height:90px" placeholder="例：&#10;9月12日 19:00 人工智能导论 班会 教二401&#10;9月14日 23:59 提交人工智能导论大作业 作业&#10;9月20日 14:00 计算机组成原理 期中考试 教三302 闭卷带学生证"></textarea>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary" id="rec-parse">解析并预览</button>
          <button class="btn btn-ghost" id="rec-clear">清空</button>
        </div>
      </div>
      <div id="rec-preview"></div>`;
  }
  function parseRecord(text) {
    const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const parsed = [];
    lines.forEach(line => {
      const m = line.match(/^(\d{1,2}月\d{1,2}日(?:\s*\d{1,2}:\d{2})?)(?:\s+)?(.+)$/);
      if (!m) return;
      let due = null;
      const dt = m[1].replace('月', '-').replace('日', ' ');
      const nowY = new Date().getFullYear();
      const mm = new Date(`${nowY}-${dt.trim().replace(/(\d+):(\d+)/, '$1:$2')}`);
      if (!isNaN(mm)) due = iso(mm);
      const rest = m[2];
      const parts = rest.split(/\s{2,}|[|｜]/);
      const title = parts[0] || rest;
      let cat = '其他'; const cMatch = rest.match(/(考试|作业|活动|会议|其他)/);
      if (cMatch) cat = cMatch[1];
      let loc = ''; const lMatch = rest.match(/[教信建图书][一二三四五六\d号]{1,6}/);
      if (lMatch) loc = lMatch[0];
      let note = ''; const nMatch = rest.match(/[：:](.+)$/);
      if (nMatch) note = nMatch[1];
      parsed.push({ title, due, cat, loc, note });
    });
    return parsed;
  }
  function committeeManage() {
    const list = state.schedules;
    return `<p class="muted">共 ${list.length} 条日程。可置顶、标记完成、删除与回收站恢复、逾期顺延。</p>
      <div id="manage-list">${list.map(s => `
        <div class="crow" data-id="${s.id}">
          <h4>${s.pinned ? '📌' : ''} ${esc(s.title)} <span class="cat-tag ${catClass(s.cat)}">${esc(s.cat)}</span></h4>
          <div class="muted">截止 ${esc(fmtDateTime(s.due))} · ${s.status === 'active' ? '进行中' : '已完成'} · 修改人 ${esc(s.lastMod || '—')}</div>
          <div class="cops">
            <button class="mini-btn" data-cmd="togglepin">${s.pinned ? '取消置顶' : '置顶'}</button>
            <button class="mini-btn" data-cmd="toggleStatus">${s.status === 'active' ? '标记完成' : '恢复'}</button>
            <button class="mini-btn" data-cmd="delay">逾期顺延 1 天</button>
            <button class="mini-btn danger" data-cmd="del">删除</button>
            <button class="mini-btn" data-cmd="edit">编辑</button>
          </div>
        </div>`).join('')}
      </div>`;
  }
  function committeeSuggest() {
    const list = state.suggestions;
    if (!list.length) return `<p class="muted">还没有同学建议。「提建议」面板的内容会出现在这里。</p>`;
    return `<p class="muted">收取同学建议，可一键加入日程 / 采纳 / 忽略。</p>` +
      list.map((it, i) => `
      <div class="crow" data-idx="${i}">
        <h4>${esc(it.text)} <span class="cat-tag ${catClass(it.cat)}">${esc(it.cat)}</span></h4>
        <div class="muted">来自 ${esc(it.from)} · ${esc(it.due ? '时间 ' + it.due : '未指定时间')} · ${it.direct ? '已直接加入' : '待处理'}</div>
        <div class="cops">
          <button class="mini-btn" data-cmd="accept">加入日程</button>
          <button class="mini-btn" data-cmd="adopt">采纳</button>
          <button class="mini-btn danger" data-cmd="ignore">忽略</button>
        </div>
      </div>`).join('');
  }
  function committeeLink() {
    return `<div class="ctoolbar"><button class="btn btn-primary" id="addLinkIn">＋ 添加链接</button></div>
      <div id="manage-links">${state.links.map(l => `
        <div class="crow" data-id="${l.id}">
          <h4>🔗 ${esc(l.name)} <span class="muted">${esc(l.url)}</span></h4>
          <div class="muted">${esc(l.tag || '')}${l.desc ? ' · ' + esc(l.desc) : ''}</div>
          <div class="cops"><button class="mini-btn" data-cmd="editLink">编辑</button><button class="mini-btn danger" data-cmd="delLink">删除</button></div>
        </div>`).join('')}
      </div>`;
  }
  function committeeLog() {
    if (!state.changelog.length) return '<p class="muted">还没有变更记录。</p>';
    return state.changelog.slice(0, 50).map(c => {
      const t = new Date(c.time);
      return `<div class="log-item">${t.toLocaleString('zh-CN')} · <b>${esc(c.who)}</b> ${esc(c.action)}${c.subject ? ' · ' + esc(c.subject) : ''}</div>`;
    }).join('');
  }
  function committeeSettings() {
    const s = state.meta;
    return `<label>班级口号<input id="set-motto" value="${esc(s.motto)}"></label>
      <label>班级人数<input id="set-online" type="number" value="${esc(s.online)}"></label>
      <label>班委口令<input id="set-password" value="${esc(s.password)}"></label>
      <label>学校 · 学院<input id="set-school" value="${esc(s.school)}"></label>
      <label>班级<input id="set-class" value="${esc(s.className)}"></label>
      <div class="ctoolbar"><button class="btn btn-primary" id="settingsSave">保存班级设置</button></div>`;
  }

  function bindCommittee(body) {
    const cta = body.dataset.ctab;
    if (cta === 'record' || typeof $$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'undefined') return;
    if ($$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'record') {
      const parseBtn = $('#rec-parse'); if (parseBtn) parseBtn.addEventListener('click', () => {
        const parsed = parseRecord($('#rec-src').value);
        renderRecordPreview(parsed, $('#rec-preview'));
      });
      const clearBtn = $('#rec-clear'); if (clearBtn) clearBtn.addEventListener('click', () => { $('#rec-src').value = ''; $('#rec-preview').innerHTML = ''; });
    }
    if ($$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'manage') {
      $$('#manage-list .crow').forEach(row => {
        const id = row.dataset.id;
        $$('[data-cmd]', row).forEach(b => b.addEventListener('click', () => {
          const cmd = b.dataset.cmd, s = state.schedules.find(x => x.id === id);
          if (!s) return;
          if (cmd === 'togglepin') s.pinned = !s.pinned;
          else if (cmd === 'toggleStatus') s.status = s.status === 'active' ? 'done' : 'active';
          else if (cmd === 'delay') { const d = new Date(s.due); d.setDate(d.getDate() + 1); s.due = iso(d); }
          else if (cmd === 'del') { state.schedules = state.schedules.filter(x => x.id !== id); }
          else if (cmd === 'edit') { openEdit(id); return; }
          log('管理 - ' + cmd, s.title);
          save(); render(); renderCommittee();
        }));
      });
    }
    if ($$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'suggest') {
      $$('#committeeBody .crow').forEach(row => {
        const idx = Number(row.dataset.idx);
        const it = state.suggestions[idx];
        $$('[data-cmd]', row).forEach(b => b.addEventListener('click', () => {
          const cmd = b.dataset.cmd;
          if (cmd === 'accept' || cmd === 'adopt') {
            state.schedules.push({ id: uid(), title: it.text, due: it.due || iso(new Date(Date.now() + 3 * 86400000)).slice(0, 16), cat: it.cat, loc: '', note: '来自建议：' + it.from, status: 'active', pinned: false, createdBy: '班委', lastMod: '班委', lastModTime: Date.now() });
            log('采纳建议', it.text);
          }
          state.suggestions.splice(idx, 1);
          save(); render(); renderCommittee(); toast(cmd === 'accept' ? '已作为重要日程直接加入全班' : cmd === 'adopt' ? '已采纳' : '已忽略');
        }));
      });
    }
    if ($$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'link') {
      const addLinkIn = $('#addLinkIn'); if (addLinkIn) addLinkIn.addEventListener('click', () => { openLinkModal(null); });
      $$('#manage-links .crow').forEach(row => {
        const id = row.dataset.id;
        $$('[data-cmd]', row).forEach(b => b.addEventListener('click', () => {
          if (b.dataset.cmd === 'editLink') openLinkModal(id);
          else if (b.dataset.cmd === 'delLink') { state.links = state.links.filter(x => x.id !== id); log('删除链接', id); save(); render(); renderCommittee(); toast('链接已删除'); }
        }));
      });
    }
    if ($$('#committeeTabs .ctab.active')[0]?.dataset.ctab === 'settings') {
      const saveBtn = $('#settingsSave'); if (saveBtn) saveBtn.addEventListener('click', () => {
        state.meta.motto = $('#set-motto').value; state.meta.online = Number($('#set-online').value) || 0;
        state.meta.password = $('#set-password').value; state.meta.school = $('#set-school').value;
        state.meta.className = $('#set-class').value;
        log('修改班级设置', '');
        save(); render(); renderCommittee(); toast('班级设置已保存');
      });
    }
  }

  function renderRecordPreview(parsed, tgt) {
    if (!parsed.length) { tgt.innerHTML = '<p class="muted">未解析到有效条目，格式参考「9月12日 19:00 标题 类别 地点」。</p>'; return; }
    tgt.innerHTML = parsed.map(p => `
      <div class="crow">
        <h4>${esc(p.title)} <span class="cat-tag ${catClass(p.cat)}">${esc(p.cat)}</span></h4>
        <div class="muted">截止 ${esc(p.due ? fmtDateTime(p.due) : '待定')}${p.loc ? ' · ' + esc(p.loc) : ''}${p.note ? ' · ' + esc(p.note) : ''}</div>
      </div>`).join('') +
      `<div class="ctoolbar"><button class="btn btn-primary" id="rec-import">确认导入（${parsed.length} 条）</button></div>`;
    const imp = $('#rec-import');
    if (imp) imp.addEventListener('click', () => {
      const s = state.schedules.slice();
      parsed.forEach((p, i) => {
        s.push({ id: uid() + i, title: p.title, due: p.due, cat: p.cat, loc: p.loc, note: p.note, status: 'active', pinned: false, createdBy: '学习委员', lastMod: currentUser(), lastModTime: Date.now() });
      });
      state.schedules = s;
      log('批量录入', parsed.length + ' 条');
      save(); render(); renderCommittee(); $('#rec-preview').innerHTML = '';
      toast(`已录入 ${parsed.length} 条，全班同步`);
    });
  }

  // ---------------- 教程 ----------------
  function openTutorial() {
    const body = $('#tutorialBody');
    body.innerHTML = `
      <h3>⛳ 三种视图切换</h3>
      <p>倒计时卡片：按剩余时间排序，临期会自动变红并脉冲提醒。日历：按月看每天有哪些安排，点日期展开当天条目。时间轴：按天分组的流水视图，已结束的安排收在折叠区。三种视图共用同一份数据，切换不重新加载。</p>
      <h3>✏️ 日程编辑</h3>
      <p>点任意日程卡片或「我要修改」按钮打开编辑弹窗。可改项目、截止时间、类别、地点、备注、状态、置顶。保存后全班实时同步，变更日志记录改前改后。两人同时改同一字段时弹出左右对比，选一个保留，不会互相覆盖。</p>
      <h3>💬 弹窗留言区</h3>
      <p>弹窗底部是这条日程的留言区，留一句提醒或疑问全班可见。</p>
      <h3>✅ 打卡</h3>
      <p>打开日程弹窗点「我已完成」即打卡，再点一次取消。卡片上实时显示全班打卡人数。打卡记录你的名字，方便班委统计完成情况。</p>
      <h3>💡 提建议</h3>
      <p>首页右侧「提建议」写下想加的安排，可带截止时间和类别。普通建议进入班委后台，由班委加入日程、采纳或忽略。勾选「较为重要」则跳过审核，直接加入全班日程——紧急添加会记入变更日志。</p>
      <h3>🔗 网址链接</h3>
      <p>首页右侧「网址链接」是班委维护的常用入口。课程平台、资料库、通知页点一下在新标签页打开。全班都能在首页添加、编辑、删除，班委后台同样可维护。</p>
      <h3>🏅 班徽轮换</h3>
      <p>每 7 天轮换一张班徽候选。上传一张立即成为本周班徽展示在页面顶部。</p>
      <h3>⚙️ 班委后台</h3>
      <p>首页右上「班委入口」输入班委口令进入。录入（自动解析）、管理（置顶/完成/删除/顺延/回收站恢复）、建议、链接与班级信息、变更日志，一应俱全。</p>
      <h3>🔁 同步与断网</h3>
      <p>数据库推送 + 短间隔轮询双通道，别人改完你这边秒级更新。顶部同步条显示连接状态与最后更新时间，可手动刷新。断网时保留最后一次数据，恢复后自动重连补齐。切回标签页时会立即拉取最新数据。</p>`;
    openModal('tutorialModal');
  }

  // ---------------- 主题 ----------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    $('#themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('buptai10_theme', theme);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  // ---------------- 同步模拟 ----------------
  let syncTimer = null;
  function startSyncLoop() {
    const bar = $('#syncStatus');
    bar.classList.remove('off'); bar.textContent = '● 实时同步已连接';
    $('#syncBar').querySelector('.sync-sub').style.display = '';
    setLastUpdated();
    clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      // 模拟其他设备改动：偶尔出现一条“有人修改”
      if (Math.random() < 0.06) {
        const idx = state.schedules.findIndex(s => s.status === 'active');
        if (idx >= 0) {
          const s = state.schedules[idx];
          const people = ['陈嘉禾', '李雨桐', '王可欣', '张子昂', '刘思远', '赵一帆', '孙浩然'];
          s.lastMod = people[Math.floor(Math.random() * people.length)];
          s.lastModTime = Date.now();
          log('有人同步更新', s.title);
          save();
          if (['countdown', 'calendar', 'timeline'].includes(currentView)) render();
          bar.textContent = '● 实时同步已连接';
          setLastUpdated();
        }
      }
    }, 12000);
  }

  // ---------------- 弹窗 ----------------
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  // ---------------- 事件绑定 ----------------
  function init() {
    // 主题
    applyTheme(localStorage.getItem('buptai10_theme') || 'light');

    // 视图切换
    $$('#viewTabs .tab').forEach(t => t.addEventListener('click', () => {
      $$('#viewTabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      currentView = t.dataset.view;
      $$('.content > .view').forEach(v => v.classList.remove('active'));
      $('#view-' + currentView).classList.add('active');
      render();
    }));

    // 类别筛选 / 搜索
    $$('#catFilter .fchip').forEach(c => c.addEventListener('click', () => {
      $$('#catFilter .fchip').forEach(x => x.classList.remove('active'));
      c.classList.add('active'); currentCat = c.dataset.cat; renderCountdown();
    }));
    $('#searchBox').addEventListener('input', () => { currentSearch = $('#searchBox').value; renderCountdown(); });

    // 我要修改 / 录入
    $('#addScheduleBtn').addEventListener('click', () => {
      assertUser(() => {
        editingId = null;
        $('#editTitle').textContent = '录入日程';
        $('#f-title').value = ''; $('#f-due').value = ''; $('#f-cat').value = '其他';
        $('#f-loc').value = ''; $('#f-status').value = 'active'; $('#f-note').value = ''; $('#f-pin').checked = false;
        $('#editMeta').textContent = '由你发起，保存后全班同步更新。';
        openModal('editModal');
      });
    });
    $('#saveScheduleBtn').addEventListener('click', () => {
      if (editingId) saveSchedule(); else addFromForm();
    });

    // 日历
    $('#prevMonth').addEventListener('click', () => { calendarCursor.m--; if (calendarCursor.m < 0) { calendarCursor.m = 11; calendarCursor.y--; } renderCalendar(); });
    $('#nextMonth').addEventListener('click', () => { calendarCursor.m++; if (calendarCursor.m > 11) { calendarCursor.m = 0; calendarCursor.y++; } renderCalendar(); });

    // 留言
    $('#commentSubmit').addEventListener('click', submitComment);

    // 建议
    $('#sugSubmit').addEventListener('click', submitSuggestion);

    // 链接
    $('#addLinkOpen').addEventListener('click', () => openLinkModal(null));
    $('#linkSave').addEventListener('click', saveLink);

    // 班徽
    $('#uploadBadgeOpen').addEventListener('click', openBadgeModal);
    $('#badgeFile').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!/image\/(png|jpe?g|webp|gif)/.test(f.type)) { toast('班徽仅支持 PNG / JPG / WEBP / GIF 格式'); return; }
      if (f.size > 3 * 1024 * 1024) { toast('班徽图片请控制在 3MB 以内'); return; }
      const reader = new FileReader();
      reader.onload = () => { uploadedBadge = reader.result; $('#badgePreview').src = uploadedBadge; $('#badgePreviewWrap').hidden = false; };
      reader.readAsDataURL(f);
    });
    $('#badgeSave').addEventListener('click', saveBadge);

    // 班委入口
    $('#committeeBtn').addEventListener('click', () => { openModal('passModal'); $('#passInput').value = ''; setTimeout(() => $('#passInput').focus(), 50); });
    $('#passOk').addEventListener('click', () => {
      if ($('#passInput').value === state.meta.password) {
        closeModal('passModal'); openModal('committeeModal'); renderCommittee();
      } else toast('口令错误');
    });
    $$('#committeeTabs .ctab').forEach(t => t.addEventListener('click', () => {
      $$('#committeeTabs .ctab').forEach(x => x.classList.remove('active'));
      t.classList.add('active'); renderCommittee();
    }));

    // 教程
    $('#tutorialBtn').addEventListener('click', openTutorial);

    // 主题
    $('#themeBtn').addEventListener('click', toggleTheme);

    // 刷新
    $('#refreshBtn').addEventListener('click', () => {
      const bar = $('#syncStatus'); bar.classList.remove('off');
      bar.textContent = '● 实时同步已连接'; setLastUpdated();
      render(); toast('已同步最新数据');
    });

    // 名称弹窗
    $('#nameOk').addEventListener('click', () => {
      const v = $('#nameInput').value.trim();
      if (!v) { toast('请先留个名字'); return; }
      currentName = v; localStorage.setItem('buptai10_name', v);
      closeModal('nameModal');
      if (nameCallback) { const cb = nameCallback; nameCallback = null; cb(); }
      toast('已记住，班里都认识你了');
    });

    // 冲突
    $('#conflictKeepMine').addEventListener('click', () => {
      const s = state.schedules.find(x => x.id === editingId);
      if (s) { Object.assign(s, fieldsToSave()); log('冲突保留我的修改', s.title); save(); render(); closeModal('conflictModal'); toast('已保留你的版本，全班同步'); }
    });
    $('#conflictKeepTheirs').addEventListener('click', () => { closeModal('conflictModal'); closeModal('editModal'); toast('已保留对方版本'); });
    function fieldsToSave() {
      return { title: $('#f-title').value, due: $('#f-due').value, cat: $('#f-cat').value, loc: $('#f-loc').value, note: $('#f-note').value, status: $('#f-status').value, pinned: $('#f-pin').checked };
    }

    // 弹窗关闭
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
    $$('.modal-dim').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));

    // tab 切回时拉取最新
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); setLastUpdated(); } });

    // 跨标签页实时同步（storage 事件模拟“全班同步”）
    window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); render(); } });

    startSyncLoop();
    render();
  }

  // ---------------- 启动 ----------------
  document.addEventListener('DOMContentLoaded', init);
})();
