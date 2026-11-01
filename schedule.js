// 첫 화면 위쪽: 오늘의 매치데이 카드 + 기아 경기 캘린더 (games 표)
// 회원은 보기만, 운영진은 날짜를 눌러 경기를 넣고 고친다.
const Sched = (() => {
  const { sb, h, toast, fail } = NH;
  const TEAMS = ["LG 트윈스", "두산 베어스", "SSG 랜더스", "키움 히어로즈", "KT 위즈", "NC 다이노스", "삼성 라이온즈", "롯데 자이언츠", "한화 이글스"];
  const PARKS = ["광주-기아 챔피언스 필드", "잠실야구장", "인천 SSG 랜더스필드", "고척스카이돔", "수원 KT 위즈파크", "창원 NC 파크", "대구 삼성 라이온즈 파크", "사직야구장", "대전 한화생명 볼파크"];
  const HOME_PARK = PARKS[0];
  const WEEK = "일월화수목금토";
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => new Date(s + "T00:00:00");
  const gameDay = s => { const t = parse(s); return `${t.getMonth() + 1}/${t.getDate()}(${WEEK[t.getDay()]})`; };
  const teamShort = t => (t || "").split(" ")[0];
  const parkShort = p => (p || "").replace(HOME_PARK, "챔필").replace(/야구장|스카이돔/, "").split(" ").pop();
  const hm = t => (t || "").slice(0, 5);

  // KBO 공식 일정(schedule.json, 봇이 몇 시간마다 갱신) + 운영진이 직접 넣은 경기(games 표)를 합친다.
  // 같은 날 같은 상대면 운영진이 넣은 쪽이 이긴다.
  let auto = [], ps = [];  // ps = 포스트시즌 다른 팀 경기 (기아 경기는 auto 에 series 가 붙어 있다)
  const SR = { "와일드카드": "WC", "준플레이오프": "준PO", "플레이오프": "PO", "한국시리즈": "KS" };
  async function loadAuto() {
    try {
      const r = await fetch("schedule.json?t=" + Date.now()), j = r.ok ? await r.json() : {};
      auto = j.games || []; ps = j.postseason || [];
    } catch { auto = []; ps = []; }
  }
  const psOn = d => ps.filter(x => x.game_date === d);
  const merge = db => {
    const key = g => g.game_date + "|" + g.opp;
    const mine = new Set(db.map(key));
    return [...db, ...auto.filter(g => !mine.has(key(g))).map(g => ({ ...g, auto: true }))]
      .sort((a, b) => (a.game_date + (a.game_time || "")).localeCompare(b.game_date + (b.game_time || "")));
  };
  let games = [], month, staff = false, picked = null, calBox, dayBox;

  function matchday(meetCount) {
    const today = ymd(new Date());
    const g = games.filter(x => x.game_date === today), other = psOn(today);
    const next = games.find(x => x.game_date > today);
    const go = (href, label) => h("a", { class: "btn small", href }, label);
    if (g.length || other.length) {
      return h("section", { class: "matchday" },
        h("span", { class: "eyebrow" }, (g.length ? "TODAY'S MATCHDAY · " : "오늘의 가을야구 · ") + gameDay(today)),
        g.map(x => h("div", { class: "md-game" },
          x.series ? h("span", { class: "md-sr" }, "🍂 " + x.series) : null,
          h("div", { class: "md-vs" }, h("b", {}, "KIA"), h("span", {}, "vs"), h("b", {}, teamShort(x.opp))),
          h("div", { class: "md-info" }, [hm(x.game_time) || "시간 미정", parkShort(x.park) || (x.home ? "챔필" : "원정"), x.tv && "📺 " + x.tv].filter(Boolean).join(" · ")),
          x.result ? h("div", { class: "md-result r-" + x.result }, x.result + (x.score ? " " + x.score : "")) : null,
          x.note ? h("div", { class: "md-note" }, x.note) : null)),
        other.map(x => h("div", { class: "md-game ps" },
          h("span", { class: "md-sr" }, "🍂 " + x.series),
          h("div", { class: "md-vs" }, h("b", {}, x.away), h("span", {}, x.score ? x.score : "vs"), h("b", {}, x.home)),
          h("div", { class: "md-info" }, [hm(x.game_time), parkShort(x.park), x.tv && "📺 " + x.tv, x.note].filter(Boolean).join(" · ")))),
        h("div", { class: "md-go" }, go("#board/meetup", "⚾ 직관메이트"), go("#board/watch", "📺 티관 모임"), go("#board/drink", "🍻 술자리·번개"),
          meetCount ? h("span", { class: "md-cnt" }, `오늘 모임 ${meetCount}개`) : null));
    }
    const dday = next ? Math.round((parse(next.game_date) - parse(today)) / 864e5) : 0;
    return h("section", { class: "matchday off" },
      h("span", { class: "eyebrow" }, "TODAY'S MATCHDAY"),
      h("div", { class: "md-off" }, "오늘은 경기가 없는 날이에요"),
      next ? h("div", { class: "md-info" }, `다음 경기 ${gameDay(next.game_date)} ${hm(next.game_time)} vs ${teamShort(next.opp)} · ${parkShort(next.park) || (next.home ? "챔필" : "원정")}`, h("b", { class: "dday" }, " D-" + dday))
        : h("div", { class: "md-info" }, "아직 올라온 경기 일정이 없어요. 2027 시즌 일정은 KBO가 발표하면 자동으로 올라와요."));
  }

  function calendar() {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const today = ymd(new Date());
    const byDay = {};
    games.forEach(g => (byDay[g.game_date] ||= []).push(g));
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(h("div", { class: "cal-cell blank" }));
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`, list = byDay[key] || [];
      cells.push(h("button", { class: ["cal-cell", key === today && "today", key === picked && "picked", list.length && "has"].filter(Boolean).join(" "),
        "aria-label": `${m + 1}월 ${d}일` + (list.length ? " 경기 있음" : ""), onclick: () => { picked = key; draw(); } },
        h("span", { class: "cal-d" }, d),
        list.map(g => h("span", { class: "chip " + (g.home ? "home" : "away") + (g.result ? " r-" + g.result : "") },
          g.series ? h("b", { class: "sr" }, SR[g.series] || g.series) : null,
          h("i", {}, "vs "), teamShort(g.opp), g.result ? h("em", {}, g.result) : h("small", {}, hm(g.game_time)))),
        psOn(key).map(g => h("span", { class: "chip ps" }, SR[g.series] || g.series, h("i", {}, ` ${g.away}-${g.home}`)))));
    }
    const shift = n => { month = new Date(y, m + n, 1); picked = null; draw(); };
    return [
      h("div", { class: "cal-head" },
        h("button", { class: "btn small", onclick: () => shift(-1), "aria-label": "이전 달" }, "‹"),
        h("h3", {}, `${y}년 ${m + 1}월 경기 일정`),
        h("button", { class: "btn small", onclick: () => shift(1), "aria-label": "다음 달" }, "›")),
      h("div", { class: "cal-legend" }, h("span", { class: "chip home" }, "홈"), h("span", { class: "chip away" }, "원정"), h("span", { class: "chip ps" }, "가을야구"),
        staff ? h("span", { class: "hint" }, "날짜를 누르면 경기를 넣고 고칠 수 있어요") : null),
      h("div", { class: "cal-grid" }, [...WEEK].map((w, i) => h("div", { class: "cal-w" + (i === 0 ? " sun" : i === 6 ? " sat" : "") }, w)), cells)];
  }

  function dayPanel() {
    if (!picked) return [];
    const list = games.filter(g => g.game_date === picked);
    const row = g => h("li", {}, h("b", {}, (g.series ? `[${g.series}] ` : "") + `vs ${g.opp}`), " ",
      [hm(g.game_time), g.park, g.tv && "📺 " + g.tv, g.result && g.result + (g.score ? " " + g.score : ""), g.note].filter(Boolean).join(" · "),
      g.auto ? h("span", { class: "hint" }, " (KBO 자동)") : null,
      staff && !g.auto ? [" ", h("button", { class: "btn small", onclick: () => editForm(g) }, "수정"),
        h("button", { class: "btn small danger", onclick: async () => {
          if (!confirm("이 경기를 지울까요?")) return;
          const { error } = await sb.from("games").delete().eq("id", g.id);
          error ? fail(error) : (toast("지웠어요"), reload());
        } }, "삭제")] : null);
    const other = psOn(picked).map(g => h("li", { class: "ps" }, h("b", {}, `[${g.series}] ${g.away} vs ${g.home}`), " ",
      [hm(g.game_time), g.park, g.tv && "📺 " + g.tv, g.score, g.note].filter(Boolean).join(" · ")));
    return [h("h4", {}, gameDay(picked)),
      list.length || other.length ? h("ul", { class: "day-games" }, list.map(row), other) : h("p", { class: "hint" }, "이날은 기아 경기가 없어요."),
      staff ? h("button", { class: "btn small primary", onclick: () => editForm() }, "+ 이날 경기 넣기") : null];
  }

  function editForm(g = {}) {
    const f = {
      game_time: h("input", { type: "time", value: hm(g.game_time) || "18:30" }),
      opp: h("select", {}, TEAMS.map(t => h("option", { value: t, selected: t === g.opp }, t))),
      park: h("select", {}, PARKS.map(p => h("option", { value: p, selected: p === (g.park || HOME_PARK) }, p))),
      tv: h("input", { maxlength: 30, value: g.tv || "", placeholder: "예: SPOTV, KBS N" }),
      result: h("select", {}, ["", "승", "패", "무", "취소"].map(r => h("option", { value: r, selected: r === (g.result || "") }, r || "결과 전"))),
      score: h("input", { maxlength: 15, value: g.score || "", placeholder: "예: 5:3" }),
      note: h("input", { maxlength: 60, value: g.note || "", placeholder: "예: 개막전, 우천 시 취소" })
    };
    const lab = (t, el) => h("label", { class: "field" }, h("span", { class: "lab" }, t), el);
    dayBox.replaceChildren(h("h4", {}, gameDay(picked) + (g.id ? " 경기 고치기" : " 경기 넣기")),
      h("div", { class: "mate-grid" }, lab("시간", f.game_time), lab("상대팀", f.opp), lab("구장", f.park), lab("중계", f.tv),
        lab("결과", f.result), lab("점수 (기아:상대)", f.score), lab("메모", f.note)),
      h("div", { class: "row end" }, h("button", { class: "btn small", onclick: draw }, "취소"),
        h("button", { class: "btn small primary", onclick: async e => {
          const row = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
          row.game_time = row.game_time || null; row.game_date = picked; row.home = row.park === HOME_PARK;
          e.target.disabled = true;
          const { error } = g.id ? await sb.from("games").update(row).eq("id", g.id) : await sb.from("games").insert(row);
          e.target.disabled = false;
          error ? fail(error) : (toast("저장했어요"), reload());
        } }, "저장")));
  }

  function draw() {
    calBox.replaceChildren(...calendar());
    dayBox.replaceChildren(...dayPanel());
    dayBox.hidden = !picked;
  }
  async function reload() {
    const { data, error } = await sb.from("games").select("*").order("game_date").order("game_time");
    if (error) return fail(error);
    games = merge(data); draw();
  }

  // 첫 화면 위쪽 조각들을 돌려준다
  async function home(isStaff, meetBoards) {
    staff = isStaff;
    const today = ymd(new Date());
    const [{ data, error }, { count }] = await Promise.all([
      loadAuto().then(() =>
      sb.from("games").select("*").order("game_date").order("game_time")),
      sb.from("posts").select("id", { count: "exact", head: true }).in("board", meetBoards).eq("meta->>date", today)
    ]);
    if (error) console.error(error);
    games = merge(error ? [] : data);
    // 이번 달에 경기가 없으면 다음 경기가 있는 달을 먼저 보여 준다
    const now = new Date(), thisMonth = today.slice(0, 7);
    const next = games.find(g => g.game_date >= today);
    const last = games[games.length - 1];
    const pick = games.some(g => g.game_date.startsWith(thisMonth)) ? null : next || last;  // 비시즌엔 다음 경기, 없으면 마지막 경기 달
    month = pick ? new Date(pick.game_date.slice(0, 7) + "-01T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
    picked = null;
    calBox = h("div", { class: "cal" }); dayBox = h("div", { class: "cal-day" });
    draw();
    return [matchday(count || 0), h("section", { class: "schedule" }, calBox, dayBox)];
  }

  return { home, TEAMS, PARKS, gameDay, teamShort, parkShort };
})();
