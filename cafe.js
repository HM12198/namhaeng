// 회원 사이트: 네이버 카페식 화면 (왼쪽 카페 정보·메뉴, 오른쪽 목록·글 보기·글쓰기)
// 주소 해시로 화면을 고른다: #all, #board/notice, #post/12, #write/free, #news, #me, #search/키워드
const Cafe = (() => {
  const { sb, h, $, toast, fail, when, roleTag, BOARD_KO } = NH;
  const MENU = [
    ["남행열차", [["notice", "공지사항"]]],
    ["커뮤니티", [["meetup", "직관 모임"], ["free", "자유게시판"]]],
    ["타이거즈 소식", [["news", "기아 뉴스"]]]
  ];
  const WRITABLE = ["meetup", "free"];
  const NAME = { notice: "공지사항", meetup: "직관 모임", free: "자유게시판" };
  let user, isStaff, side, content;

  const day = s => new Date(s).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\s/g, "").replace(/\.$/, "");
  const go = hash => { location.hash = hash; };
  const authorName = p => p.profiles?.nickname || p.profiles?.kakao_name || "알 수 없음";

  async function sidebar() {
    const [{ count: members }, { data: owner }, { count: posts }] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }).in("role", ["member", "staff", "owner"]),
      sb.from("profiles").select("nickname,kakao_name,created_at").eq("role", "owner").limit(1),
      sb.from("posts").select("id", { count: "exact", head: true }).neq("board", "staff")
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
      isStaff ? h("a", { class: "btn block", href: "staff/" }, "운영진 방") : null,
      h("div", { class: "search" }, q, h("button", { class: "btn small", onclick: () => q.value.trim() && go("#search/" + encodeURIComponent(q.value.trim())) }, "검색")),
      h("nav", { class: "menu", "aria-label": "게시판" },
        link("#all", "전체글보기", String(posts ?? "")),
        MENU.map(([group, items]) => [h("div", { class: "group" }, group), items.map(([k, label]) => link(k === "news" ? "#news" : "#board/" + k, label))]),
        h("div", { class: "group" }, "나의 활동"), link("#me", "내 정보")));
    mark();
  }

  function mark() {
    const cur = location.hash.split("/").slice(0, 2).join("/") || "#all";
    side.querySelectorAll(".menu a").forEach(a => a.classList.toggle("on", a.dataset.hash === cur));
  }

  async function list(board, keyword) {
    const title = keyword ? `"${keyword}" 검색 결과` : board ? NAME[board] : "전체글보기";
    const canWrite = board ? (WRITABLE.includes(board) || (board === "notice" && isStaff)) : false;
    let q = sb.from("posts").select("id,board,title,pinned,created_at,profiles(nickname,kakao_name)").neq("board", "staff");
    if (board) q = q.eq("board", board);
    if (keyword) q = q.ilike("title", `%${keyword.replace(/[%_]/g, "")}%`);
    const { data, error } = await q.order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) return fail(error);
    const rows = data.map(p => h("tr", { class: p.pinned ? "pinned" : "" },
      h("td", { class: "t" }, h("a", { href: "#post/" + p.id },
        !board ? h("span", { class: "bd" }, BOARD_KO[p.board]) : null, p.pinned ? h("span", { class: "pin" }, "공지") : null, p.title)),
      h("td", { class: "a" }, authorName(p)), h("td", { class: "d" }, day(p.created_at))));
    content.replaceChildren(
      h("div", { class: "list-head" }, h("h2", {}, title), canWrite ? h("a", { class: "btn primary small", href: "#write/" + board }, "글쓰기") : null),
      data.length ? h("table", { class: "posts" },
        h("thead", {}, h("tr", {}, h("th", {}, "제목"), h("th", { class: "a" }, "작성자"), h("th", { class: "d" }, "작성일"))),
        h("tbody", {}, rows)) : h("p", { class: "empty" }, keyword ? "찾는 글이 없어요." : "아직 글이 없어요. 첫 글을 남겨 주세요!"));
  }

  async function post(id) {
    const { data: p, error } = await sb.from("posts").select("id,board,title,body,pinned,created_at,author,profiles(nickname,kakao_name)").eq("id", id).maybeSingle();
    if (error) return fail(error);
    if (!p) return content.replaceChildren(h("p", { class: "empty" }, "없는 글이거나 볼 수 없는 글이에요."), h("a", { class: "btn", href: "#all" }, "목록"));
    const mine = p.author === user.id;
    content.replaceChildren(h("article", { class: "post" },
      h("a", { class: "crumb", href: "#board/" + p.board }, NAME[p.board] + " ›"),
      h("h2", {}, p.title),
      h("div", { class: "by" }, h("b", {}, authorName(p)), h("span", { class: "meta" }, when(p.created_at))),
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
          error ? fail(error) : (toast("지웠어요"), go("#board/" + p.board), sidebar());
        } }, "삭제") : null,
        h("a", { class: "btn small", href: "#board/" + p.board }, "목록"))));
  }

  // 새 글이면 old 없이, 수정이면 old = 기존 글
  function write(board, old) {
    const boards = [...WRITABLE, ...(isStaff ? ["notice"] : [])];
    if (old) board = old.board;
    if (!boards.includes(board)) board = "free";
    const sel = h("select", { "aria-label": "게시판" }, boards.map(b => h("option", { value: b, selected: b === board }, NAME[b])));
    const title = h("input", { maxlength: 80, placeholder: "제목을 입력해 주세요" });
    const body = h("textarea", { maxlength: 5000, placeholder: "내용을 입력해 주세요", rows: 12 });
    if (old) { title.value = old.title; body.value = old.body || ""; }
    content.replaceChildren(h("section", { class: "editor" }, h("h2", {}, old ? "글 수정" : "카페 글쓰기"), sel, title, body,
      h("div", { class: "row end" }, h("a", { class: "btn", href: old ? "#post/" + old.id : "#board/" + board }, "취소"),
        h("button", { class: "btn primary", onclick: async e => {
          if (!title.value.trim()) return toast("제목을 적어 주세요");
          e.target.disabled = true;
          const row = { board: sel.value, title: title.value.trim(), body: body.value.trim() };
          const { data, error } = old
            ? await sb.from("posts").update(row).eq("id", old.id).select("id").single()
            : await sb.from("posts").insert(row).select("id").single();
          e.target.disabled = false;
          if (error) return fail(error);
          toast(old ? "고쳤어요" : "올렸어요"); sidebar(); go("#post/" + data.id);
        } }, old ? "수정 완료" : "등록"))));
    title.focus();
  }

  function me() {
    content.replaceChildren(h("section", { class: "card" }, h("h2", {}, "내 정보"),
      h("p", { class: "hint" }, "닉네임은 단톡방과 똑같이 맞춰 주세요. (이름/연도/성별/지역)"),
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
      const { data, error } = await sb.from("posts").select("id,board,title,body,author").eq("id", +arg).maybeSingle();
      if (error) return fail(error);
      if (!data || (data.author !== user.id && !isStaff)) return go("#post/" + arg);
      return write(null, data);
    }
    if (kind === "search" && arg) return list(null, decodeURIComponent(arg));
    if (kind === "news") { content.replaceChildren(h("div", { class: "list-head" }, h("h2", {}, "기아 뉴스"))); const box = h("div"); content.append(box); return NH.news(box); }
    if (kind === "me") return me();
    return list(null);
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
