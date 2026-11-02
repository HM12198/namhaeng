// 회원 사이트: 네이버 카페식 화면 (왼쪽 카페 정보·메뉴, 오른쪽 목록·글 보기·글쓰기)
// 주소 해시로 화면을 고른다: #all, #board/notice, #post/12, #write/free, #news, #me, #search/키워드
const Cafe = (() => {
  const { sb, h, $, toast, fail, when, roleTag, BOARD_KO } = NH;
  const MENU = [
    ["남행열차", [["notice", "공지사항"]]],
    ["모임", [["meetup", "⚾ 직관메이트"], ["watch", "📺 티관 모임"], ["drink", "🍻 술자리·번개"]]],
    ["커뮤니티", [["gallery", "📷 갤러리"], ["free", "자유게시판"]]],
    ["타이거즈", [["news", "기아 뉴스"]]]
  ];
  // 공식 채널 바로가기 (누구나 볼 수 있는 공개 링크라 코드에 둔다)
  const TIGERS_LINKS = [
    ["갸티비 (공식 유튜브)", "https://www.youtube.com/channel/UCKp8knO8a6tSI1oaLjfd9XA"],
    ["응원가 모음", "https://www.youtube.com/results?search_query=%EA%B8%B0%EC%95%84%ED%83%80%EC%9D%B4%EA%B1%B0%EC%A6%88+%EC%9D%91%EC%9B%90%EA%B0%80"],
    ["팀스토어 (공식 굿즈)", "https://teamstore.tigers.co.kr/"],
    ["기아 타이거즈 공식 홈", "https://tigers.co.kr"]
  ];
  const NAME = { notice: "공지사항", meetup: "직관메이트 구하기", watch: "티관 모임", drink: "술자리·번개", bungae: "번개·기타", gallery: "갤러리", free: "자유게시판" };

  // 모임 양식: 게시판마다 칸이 다르고, 값은 posts.meta 에 저장한다
  const { TEAMS, PARKS, gameDay, teamShort } = Sched;
  const TICKET = ["각자 예매", "제가 같이 예매해요", "양도 구해요"];
  const MOOD = ["경기 보며 한잔", "경기 끝나고 뒤풀이", "야구 얘기하며 한잔", "번개 (술 없이도 OK)", "기타"];
  const opt = (list, cur, blank) => [blank ? h("option", { value: "" }, blank) : null, list.map(t => h("option", { value: t, selected: t === cur }, t))];
  const FIELD = {  // 키: [라벨, 입력칸 만들기]
    date: ["📅 날짜", m => h("input", { type: "date", value: m.date || "" })],
    opp: ["⚾ 상대팀", m => h("select", {}, opt(TEAMS, m.opp, "상대팀 선택"))],
    park: ["🏟️ 구장", m => h("input", { list: "parks", value: m.park || PARKS[0], maxlength: 30 })],
    meet_time: ["⏰ 만날 시간", m => h("input", { type: "time", value: m.meet_time || "" })],
    meet_place: ["📍 만날 장소", m => h("input", { maxlength: 40, value: m.meet_place || "", placeholder: "예: 챔필 1루 출입구 앞, 광주송정역 2번 출구" })],
    area: ["🗺️ 지역", m => h("input", { maxlength: 20, value: m.area || "", placeholder: "예: 광주 상무지구, 서울 강남" })],
    place: ["📍 장소", m => h("input", { maxlength: 40, value: m.place || "", placeholder: "예: ○○ 스포츠펍, 정해지면 알려드려요" })],
    what: ["🎯 뭐 해요", m => h("input", { maxlength: 30, value: m.what || "", placeholder: "예: 삼겹살에 소주, 굿즈 같이 사러 가요" })],
    people: ["🙋 모집 인원", m => h("input", { type: "number", min: 1, max: 30, value: m.people || 2, inputmode: "numeric" })],
    seat: ["💺 좌석·구역", m => h("input", { maxlength: 40, value: m.seat || "", placeholder: "예: 3루 K9 응원석, 아직 미정" })],
    ticket: ["🎫 티켓", m => h("select", {}, opt(TICKET, m.ticket))],
    after: ["🍻 뒤풀이", m => h("select", {}, opt(["미정", "있어요", "없어요"], m.after))],
    mood: ["🍺 어떤 모임", m => h("select", {}, opt(MOOD, m.mood))],
    cost: ["💸 회비", m => h("input", { maxlength: 30, value: m.cost || "", placeholder: "예: 1/N, 1인 2만원" })],
    carpool: ["🚗 카풀", m => h("input", { maxlength: 40, value: m.carpool || "", placeholder: "예: 서산 출발 2자리 / 없음" })]
  };
  const place = m => m.park ? Sched.parkShort(m.park) : m.area;
  const KINDS = {  // 게시판: [칸 목록(★=필수), 자동 제목]
    meetup: [["date★경기 날짜", "opp★", "park★", "meet_time★", "meet_place★", "people★", "seat", "ticket", "after", "carpool"],
      m => `[${gameDay(m.date)} ${place(m)}] vs ${teamShort(m.opp)} 직관메이트 ${m.people}명 구해요`],
    watch: [["date★경기 날짜", "opp★", "meet_time★", "area★", "place★", "people★", "cost", "after"],
      m => `[${gameDay(m.date)} ${m.area}] vs ${teamShort(m.opp)} 같이 티관해요 (${m.people}명)`],
    drink: [["date★", "meet_time★", "area★", "mood", "what", "place★", "people★", "cost"],
      m => `[${gameDay(m.date)} ${m.area}] ${m.what || m.mood} ${m.people}명 모여요`],
    // 예전 번개 게시판 글 보기용 (메뉴·글쓰기에선 술자리·번개로 합침)
    bungae: [["date★", "meet_time★", "area★", "what★", "place", "people★", "cost"],
      m => `[${gameDay(m.date)} ${m.area}] ${m.what} 번개 ${m.people}명`]
  };
  // "date★경기 날짜" → 키 date, 필수, 라벨 바꿈
  const spec = s => { const [k, rest] = s.split("★"); const [icon, ...w] = FIELD[k][0].split(" ");
    return { k, req: rest !== undefined, label: rest ? icon + " " + rest : FIELD[k][0] }; };
  const isMeet = p => KINDS[p.board] && p.meta?.date;
  const statusTag = m => m.status === "closed" ? h("span", { class: "st closed" }, "마감") : h("span", { class: "st open" }, "모집중");

  function meetForm(board, m = {}) {
    const specs = KINDS[board][0].map(spec);
    const f = Object.fromEntries(specs.map(s => [s.k, FIELD[s.k][1](m)]));
    const box = h("section", { class: "mate-form" },
      board === "meetup" ? h("datalist", { id: "parks" }, PARKS.map(x => h("option", { value: x }))) : null,
      h("p", { class: "hint" }, "★ 표시는 꼭 적어 주세요. 제목을 비워 두면 자동으로 만들어 드려요."),
      h("div", { class: "mate-grid" }, specs.map(s => h("label", { class: "field" },
        h("span", { class: "lab" }, s.label, s.req ? h("span", { class: "req" }, " ★") : null), f[s.k]))));
    box.read = () => {
      const v = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
      v.people = Math.max(1, Math.min(30, parseInt(v.people, 10) || 0));
      const miss = specs.filter(s => s.req && !v[s.k]).map(s => s.label.replace(/^\S+\s/, ""));
      return { v: { ...v, status: m.status || "open" }, miss };
    };
    box.makeTitle = v => KINDS[board][1](v);
    return box;
  }

  function meetCard(p, canEdit, reload) {
    const m = p.meta;
    const specs = KINDS[p.board][0].map(spec);
    const val = { ...m, date: gameDay(m.date), people: m.people + "명", opp: m.opp && "vs " + m.opp };
    const head = [gameDay(m.date), m.meet_time, m.park || m.area, m.opp && "vs " + teamShort(m.opp)].filter(Boolean).join(" · ");
    return h("section", { class: "mate-card" },
      h("div", { class: "mate-top" }, statusTag(m), h("b", {}, head)),
      h("dl", {}, specs.filter(s => m[s.k]).map(s => [h("dt", {}, s.label), h("dd", {}, String(val[s.k]))])),
      canEdit ? h("button", { class: "btn small", onclick: async () => {
        const meta = { ...m, status: m.status === "closed" ? "open" : "closed" };
        const { error } = await sb.from("posts").update({ meta }).eq("id", p.id);
        error ? fail(error) : (toast(meta.status === "closed" ? "모집을 마감했어요" : "다시 모집해요"), reload());
      } }, m.status === "closed" ? "다시 모집하기" : "모집 마감하기") : null);
  }
  const WRITABLE = ["meetup", "watch", "drink", "gallery", "free"];
  let user, isStaff, side, content;

  const day = s => new Date(s).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\s/g, "").replace(/\.$/, "");
  const go = hash => { location.hash = hash; };
  const authorName = p => p.profiles?.nickname || p.profiles?.kakao_name || "알 수 없음";

  async function sidebar() {
    const [{ count: members }, { data: owner }, { count: posts }, { data: links }] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }).in("role", ["member", "staff", "owner"]),
      sb.from("profiles").select("nickname,kakao_name,created_at").eq("role", "owner").limit(1),
      sb.from("posts").select("id", { count: "exact", head: true }).neq("board", "staff"),
      sb.from("cafe_links").select("title,url,note").order("sort")
    ]);
    const o = owner?.[0];
    const q = h("input", { placeholder: "글 제목 검색", maxlength: 30, "aria-label": "글 제목 검색",
      onkeydown: e => { if (e.key === "Enter" && q.value.trim()) go("#search/" + encodeURIComponent(q.value.trim())); } });
    const link = (hash, label, extra) => h("a", { href: hash, "data-hash": hash }, label, extra ? h("span", { class: "cnt" }, extra) : null);
    side.replaceChildren(
      h("section", { class: "cafe-info" },
        h("div", { class: "row" }, h("img", { src: "assets/app-icon-tigers.png", alt: "", width: 44, height: 44 }),
          h("div", {}, h("b", {}, o ? (o.nickname || o.kakao_name) : "방장"), h("span", { class: "tag owner" }, "방장"),
            h("div", { class: "meta" }, o ? day(o.created_at) + " 개설" : ""))),
        h("ul", { class: "facts" },
          h("li", {}, "👥 회원 ", h("b", {}, String(members ?? "-")), "명"),
          h("li", {}, "📍 전국 · 기아 타이거즈 팬"),
          h("li", {}, "나 ", roleTag(user.role), " ", user.nickname || user.kakao_name))),
      h("a", { class: "btn primary block", href: "#write/free" }, "카페 글쓰기"),
      h("a", { class: "btn block", href: "#write/meetup" }, "🙌 모임 만들기"),
      isStaff ? h("a", { class: "btn block", href: "staff/" }, "운영진 방") : null,
      h("div", { class: "search" }, q, h("button", { class: "btn small", onclick: () => q.value.trim() && go("#search/" + encodeURIComponent(q.value.trim())) }, "검색")),
      h("nav", { class: "menu", "aria-label": "게시판" },
        link("#all", "전체글보기", String(posts ?? "")),
        MENU.map(([group, items]) => [h("div", { class: "group" }, group), items.map(([k, label]) => link(k === "news" ? "#news" : "#board/" + k, label)),
          group === "타이거즈" ? TIGERS_LINKS.map(([t, u]) => h("a", { class: "ext", href: u, target: "_blank", rel: "noopener noreferrer" }, t)) : null]),
        // 맛집지도 같은 바깥 링크: 참여코드가 있어 코드 대신 회원만 읽는 cafe_links 표에 둔다
        links?.length ? [h("div", { class: "group" }, "함께 하기"),
          links.filter(l => /^https:\/\//.test(l.url)).map(l => h("a", { class: "ext", href: l.url, target: "_blank", rel: "noopener noreferrer", title: l.note }, l.title))] : null,
        h("div", { class: "group" }, "나의 활동"), link("#me", "내 정보")));
    mark();
  }

  function mark() {
    const cur = location.hash.split("/").slice(0, 2).join("/") || "#all";
    side.querySelectorAll(".menu a").forEach(a => a.classList.toggle("on", a.dataset.hash === cur));
  }

  async function list(board, keyword, top = []) {
    const title = keyword ? `"${keyword}" 검색 결과` : board ? NAME[board] : "전체글보기";
    const canWrite = board ? (WRITABLE.includes(board) || (board === "notice" && isStaff)) : false;
    let q = sb.from("posts").select("id,board,title,pinned,created_at,meta,profiles!posts_author_fkey(nickname,kakao_name),comments(count),attendees(count)").neq("board", "staff");
    if (board) q = q.eq("board", board);
    if (keyword) q = q.ilike("title", `%${keyword.replace(/[%_]/g, "")}%`);
    const { data, error } = await q.order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) return fail(error);
    const rows = data.map(p => h("tr", { class: p.pinned ? "pinned" : "" },
      h("td", { class: "t" }, h("a", { href: "#post/" + p.id },
        !board ? h("span", { class: "bd" }, BOARD_KO[p.board]) : null, p.pinned ? h("span", { class: "pin" }, "공지") : null,
        isMeet(p) ? statusTag(p.meta) : null, p.board === "gallery" ? "📷 " : null, p.title,
        isMeet(p) ? h("span", { class: "cnt-att" }, ` 🙋${p.attendees?.[0]?.count || 0}/${p.meta.people}`) : null,
        p.comments?.[0]?.count ? h("span", { class: "cnt-cm" }, ` [${p.comments[0].count}]`) : null)),
      h("td", { class: "a" }, authorName(p)), h("td", { class: "d" }, day(p.created_at))));
    const head = h("div", { class: "list-head" }, h("h2", {}, title), canWrite ? h("a", { class: "btn primary small", href: "#write/" + board }, board === "gallery" ? "📷 사진 올리기" : "글쓰기") : null);
    if (board === "gallery" && !keyword)
      return content.replaceChildren(...top, head, data.length ? Gallery.grid(data, authorName) : h("p", { class: "empty" }, "아직 사진이 없어요. 직관·티관·모임 사진을 올려 주세요!"));
    content.replaceChildren(...top, head,
      data.length ? h("table", { class: "posts" },
        h("thead", {}, h("tr", {}, h("th", {}, "제목"), h("th", { class: "a" }, "작성자"), h("th", { class: "d" }, "작성일"))),
        h("tbody", {}, rows)) : h("p", { class: "empty" }, keyword ? "찾는 글이 없어요." : "아직 글이 없어요. 첫 글을 남겨 주세요!"));
  }

  async function post(id) {
    const { data: p, error } = await sb.from("posts").select("id,board,title,body,pinned,created_at,author,meta,profiles!posts_author_fkey(nickname,kakao_name)").eq("id", id).maybeSingle();
    if (error) return fail(error);
    if (!p) return content.replaceChildren(h("p", { class: "empty" }, "없는 글이거나 볼 수 없는 글이에요."), h("a", { class: "btn", href: "#all" }, "목록"));
    const mine = p.author === user.id;
    content.replaceChildren(h("article", { class: "post" },
      h("a", { class: "crumb", href: "#board/" + p.board }, NAME[p.board] + " ›"),
      h("h2", {}, p.title),
      h("div", { class: "by" }, h("b", {}, authorName(p)), h("span", { class: "meta" }, when(p.created_at))),
      isMeet(p) ? meetCard(p, mine || isStaff, () => post(id)) : null,
      isMeet(p) ? attendBox(p, mine) : null,
      p.board === "gallery" ? Gallery.photos(p.meta) : null,
      h("div", { class: "body" }, p.body || ""),
      h("div", { class: "row end" },
        isStaff && p.board === "notice" ? h("button", { class: "btn small", onclick: async () => {
          const { error } = await sb.from("posts").update({ pinned: !p.pinned }).eq("id", p.id);
          error ? fail(error) : (toast(p.pinned ? "고정 해제" : "상단 고정"), post(id));
        } }, p.pinned ? "고정 해제" : "상단 고정") : null,
        mine || isStaff ? h("a", { class: "btn small", href: "#edit/" + p.id }, "수정") : null,
        mine || isStaff ? h("button", { class: "btn small danger", onclick: async () => {
          if (!confirm("이 글을 지울까요?")) return;
          const { error } = await sb.from("posts").delete().eq("id", p.id);
          if (error) return fail(error);
          if (p.board === "gallery") await Gallery.remove(p.meta?.photos);
          toast("지웠어요"); go("#board/" + p.board); sidebar();
        } }, "삭제") : null,
        h("a", { class: "btn small", href: "#board/" + p.board }, "목록")),
      commentBox(p)));
  }

  // 모임 참석 신청: 누구나 "참석할게요", 모임장·운영진은 명단에서 뺄 수 있다
  function attendBox(p, mine) {
    const box = h("section", { class: "attend" });
    const nameOf = a => a.profiles?.nickname || a.profiles?.kakao_name || "알 수 없음";
    async function load() {
      const { data, error } = await sb.from("attendees").select("user_id,created_at,profiles!attendees_user_id_fkey(nickname,kakao_name)").eq("post_id", p.id).order("created_at");
      if (error) return fail(error);
      const joined = data.some(a => a.user_id === user.id), full = data.length >= p.meta.people;
      const closed = p.meta.status === "closed";
      box.replaceChildren(
        h("div", { class: "attend-head" }, h("b", {}, `🙋 참석 ${data.length} / ${p.meta.people}명`),
          joined ? h("button", { class: "btn small", onclick: async () => {
            const { error } = await sb.from("attendees").delete().eq("post_id", p.id).eq("user_id", user.id);
            error ? fail(error) : (toast("참석을 취소했어요"), load());
          } }, "참석 취소")
          : closed ? h("span", { class: "hint" }, "모집이 마감됐어요")
          : h("button", { class: "btn small primary", onclick: async () => {
            if (full && !confirm("모집 인원이 다 찼어요. 그래도 대기로 올릴까요?")) return;
            const { error } = await sb.from("attendees").insert({ post_id: p.id });
            error ? fail(error) : (toast("참석 신청했어요!"), load());
          } }, full ? "대기 신청" : "참석할게요")),
        data.length ? h("ol", { class: "attend-list" }, data.map((a, i) => h("li", { class: i >= p.meta.people ? "wait" : "" },
          nameOf(a), i >= p.meta.people ? h("span", { class: "hint" }, " (대기)") : null,
          (mine || isStaff) && a.user_id !== user.id ? h("button", { class: "x", title: "명단에서 빼기", onclick: async () => {
            if (!confirm(nameOf(a) + " 님을 명단에서 뺄까요?")) return;
            const { error } = await sb.from("attendees").delete().eq("post_id", p.id).eq("user_id", a.user_id);
            error ? fail(error) : load();
          } }, "×") : null)))
          : h("p", { class: "hint" }, "아직 참석자가 없어요. 첫 번째로 손 들어 주세요!"));
    }
    load();
    return box;
  }

  // 댓글
  function commentBox(p) {
    const box = h("section", { class: "comments" });
    const input = h("textarea", { maxlength: 1000, rows: 3, placeholder: "댓글을 남겨 주세요" });
    async function load() {
      const { data, error } = await sb.from("comments").select("id,body,created_at,author,profiles!comments_author_fkey(nickname,kakao_name)").eq("post_id", p.id).order("created_at");
      if (error) return fail(error);
      box.replaceChildren(h("h3", {}, `댓글 ${data.length}`),
        h("ul", { class: "cm-list" }, data.map(c => h("li", {},
          h("div", { class: "cm-by" }, h("b", {}, authorName(c)), c.author === p.author ? h("span", { class: "tag" }, "작성자") : null,
            h("span", { class: "meta" }, when(c.created_at)),
            c.author === user.id || isStaff ? h("button", { class: "x", title: "댓글 지우기", onclick: async () => {
              if (!confirm("댓글을 지울까요?")) return;
              const { error } = await sb.from("comments").delete().eq("id", c.id);
              error ? fail(error) : load();
            } }, "×") : null),
          h("div", { class: "cm-body" }, c.body)))),
        h("div", { class: "cm-write" }, input, h("button", { class: "btn primary small", onclick: async e => {
          const body = input.value.trim();
          if (!body) return toast("댓글을 적어 주세요");
          e.target.disabled = true;
          const { error } = await sb.from("comments").insert({ post_id: p.id, body });
          e.target.disabled = false;
          if (error) return fail(error);
          input.value = ""; load();
        } }, "등록")));
    }
    load();
    return box;
  }

  // 새 글이면 old 없이, 수정이면 old = 기존 글
  function write(board, old) {
    const boards = [...WRITABLE, ...(isStaff ? ["notice"] : []), ...(old?.board === "bungae" ? ["bungae"] : [])];
    if (old) board = old.board;
    if (!boards.includes(board)) board = "free";
    const sel = h("select", { "aria-label": "게시판" }, boards.map(b => h("option", { value: b, selected: b === board }, NAME[b])));
    const title = h("input", { maxlength: 80, placeholder: "제목을 입력해 주세요" });
    const body = h("textarea", { maxlength: 5000, placeholder: "내용을 입력해 주세요", rows: 12 });
    if (old) { title.value = old.title; body.value = old.body || ""; }
    const forms = Object.fromEntries(Object.keys(KINDS).filter(k => boards.includes(k)).map(k => [k, meetForm(k, old?.board === k ? old.meta : {})]));
    const pics = boards.includes("gallery") ? Gallery.picker(user.id, old?.board === "gallery" ? old.meta : {}) : null;
    const sync = () => {
      const on = !!forms[sel.value];
      Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== sel.value; });
      if (pics) pics.hidden = sel.value !== "gallery";
      title.placeholder = on ? "제목 (비워 두면 자동으로 만들어요)" : "제목을 입력해 주세요";
      body.placeholder = on ? "하고 싶은 말 (예: 응원 열심히 하실 분, 초보 환영!)" : "내용을 입력해 주세요";
      body.rows = on ? 5 : 12;
      if (sel.value === "gallery") { title.placeholder = "제목 (비워 두면 자동으로 만들어요)"; body.placeholder = "사진 설명 (예: 오늘 챔필 분위기 미쳤다 🔥)"; body.rows = 4; }
    };
    sel.addEventListener("change", sync); sync();
    content.replaceChildren(h("section", { class: "editor" }, h("h2", {}, old ? "글 수정" : "카페 글쓰기"), sel, Object.values(forms), pics, title, body,
      h("div", { class: "row end" }, h("a", { class: "btn", href: old ? "#post/" + old.id : "#board/" + board }, "취소"),
        h("button", { class: "btn primary", onclick: async e => {
          const row = { board: sel.value, title: title.value.trim(), body: body.value.trim(), meta: {} };
          const form = forms[row.board];
          if (form) {
            const { v, miss } = form.read();
            if (miss.length) return toast("빈 칸: " + miss.join(", "));
            row.meta = v;
            if (!row.title) row.title = form.makeTitle(v).slice(0, 80);
          }
          let removed = [];
          if (row.board === "gallery") {
            if (!pics.count()) return toast("사진을 한 장 이상 골라 주세요");
            if (!row.title) row.title = `[${pics.tag()}] 사진 ${pics.count()}장`;
            e.target.disabled = true;
            try { ({ meta: row.meta, removed } = await pics.save(t => { e.target.textContent = t; })); }
            catch (err) { e.target.disabled = false; e.target.textContent = old ? "수정 완료" : "등록"; return fail(err); }
          }
          if (!row.title) return toast("제목을 적어 주세요");
          e.target.disabled = true;
          const { data, error } = old
            ? await sb.from("posts").update(row).eq("id", old.id).select("id").single()
            : await sb.from("posts").insert(row).select("id").single();
          e.target.disabled = false; e.target.textContent = old ? "수정 완료" : "등록";
          if (error) return fail(error);
          if (removed.length) await Gallery.remove(removed);
          toast(old ? "고쳤어요" : "올렸어요"); sidebar(); go("#post/" + data.id);
        } }, old ? "수정 완료" : "등록"))));
    (forms[sel.value]?.querySelector("input,select") || title).focus();
  }

  function me() {
    content.replaceChildren(h("section", { class: "card" }, h("h2", {}, "내 정보"),
      h("p", { class: "hint" }, "닉네임은 단톡방과 똑같이 맞춰 주세요. 이름은 성 빼고 (예: 호명/98/남/서산)"),
      NH.nicknameForm(user, sidebar)));
  }

  async function route() {
    const [kind, arg] = location.hash.slice(1).split("/");
    mark();
    content.replaceChildren(h("p", { class: "hint" }, "불러오는 중…"));
    if (kind === "board" && NAME[arg]) return list(arg);
    if (kind === "post" && /^\d+$/.test(arg)) return post(+arg);
    if (kind === "write") return write(arg);
    if (kind === "edit" && /^\d+$/.test(arg)) {
      const { data, error } = await sb.from("posts").select("id,board,title,body,author,meta").eq("id", +arg).maybeSingle();
      if (error) return fail(error);
      if (!data || (data.author !== user.id && !isStaff)) return go("#post/" + arg);
      return write(null, data);
    }
    if (kind === "search" && arg) return list(null, decodeURIComponent(arg));
    if (kind === "news") { content.replaceChildren(h("div", { class: "list-head" }, h("h2", {}, "기아 뉴스"))); const box = h("div"); content.append(box); return NH.news(box); }
    if (kind === "me") return me();
    // 첫 화면: 오늘의 매치데이 + 경기 캘린더 + 전체글
    const top = await Sched.home(isStaff, Object.keys(KINDS));
    return list(null, null, top);
  }

  function mount(u) {
    user = u; isStaff = ["staff", "owner"].includes(u.role);
    side = h("aside", { class: "side" }); content = h("section", { class: "content" });
    $("main").replaceChildren(h("div", { class: "cafe" }, side, content));
    $("main").parentElement.classList.add("wide");
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
    sidebar(); route();
  }
  return { mount };
})();
