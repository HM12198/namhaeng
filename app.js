// 회원 사이트와 운영진 방이 같이 쓰는 로그인·게시판 코드
const NH = (() => {
  const cfg = window.NH_CONFIG;
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY;
  const sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const ROLE_KO = { pending: "승인 대기", member: "회원", staff: "운영진", owner: "방장", banned: "강퇴" };
  const BOARD_KO = { notice: "공지", meetup: "직관 모임", free: "자유", staff: "운영진" };

  // 화면 조각은 전부 이걸로 만든다 (textContent만 써서 글 내용이 HTML로 해석되지 않게)
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  const $ = id => document.getElementById(id);
  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2000); }
  const when = s => new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const roleTag = r => h("span", { class: "tag " + r }, ROLE_KO[r] || r);
  function fail(e) { console.error(e); toast(e.message?.includes("권한") ? e.message : "처리하지 못했어요. 잠시 뒤 다시 해 주세요"); }

  async function login() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: location.origin + location.pathname, scopes: "profile_nickname profile_image" }
    });
    if (error) fail(error);
  }
  async function logout() { await sb.auth.signOut(); location.reload(); }

  async function me() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from("profiles").select("id,nickname,kakao_name,role").eq("id", session.user.id).single();
    if (error) { fail(error); return null; }
    return data;
  }

  function header(title, user) {
    const who = $("who"); who.replaceChildren();
    $("title").replaceChildren(h("em", {}, "남행열차"), " " + title);
    if (user) who.append(h("span", {}, user.nickname || user.kakao_name || "이름 없음"), roleTag(user.role), h("button", { onclick: logout }, "로그아웃"));
  }

  function screen(...kids) { $("main").replaceChildren(...kids); $("nav").hidden = true; }

  function loginScreen(msg) {
    screen(h("section", { class: "card center" },
      h("h2", {}, msg),
      h("p", { class: "hint" }, "카카오 계정으로 로그인해요. 처음이면 방장 승인 후 들어올 수 있어요."),
      h("button", { class: "btn kakao", onclick: login }, "카카오로 로그인")));
  }

  function setupScreen() {
    screen(h("section", { class: "card center" }, h("h2", {}, "아직 연결 전이에요"),
      h("p", { class: "hint" }, "config.js에 Supabase 주소와 키를 넣으면 열려요.")));
  }

  function nicknameForm(user, after) {
    const inp = h("input", { value: user.nickname, maxlength: 30, placeholder: "이름/연도/성별/지역 (예: 박기아/95/남/광주)" });
    return h("div", { class: "row" }, inp, h("button", { class: "btn primary", onclick: async () => {
      const nickname = inp.value.trim();
      if (!nickname) return toast("닉네임을 적어 주세요");
      const { error } = await sb.from("profiles").update({ nickname }).eq("id", user.id);
      if (error) return fail(error);
      user.nickname = nickname; toast("저장했어요"); after && after();
    } }, "저장"));
  }

  function waitScreen(user) {
    const banned = user.role === "banned";
    screen(h("section", { class: "card center" },
      h("h2", {}, banned ? "이용이 제한된 계정이에요" : "방장 승인을 기다리고 있어요"),
      banned ? h("p", { class: "hint" }, "문의는 방장 1:1 오픈채팅으로 주세요.")
        : [h("p", { class: "hint" }, "단톡방과 같은 닉네임을 적어 두시면 승인이 빨라요."), nicknameForm(user),
           h("p", { class: "hint" }, "가입신청서를 아직 안 보내셨다면 "), h("a", { href: cfg.APPLY_URL, target: "_blank", rel: "noopener" }, "가입신청 하러 가기")],
      h("a", { href: cfg.OWNER_CHAT, target: "_blank", rel: "noopener" }, "방장 1:1 오픈채팅")));
  }

  function tabs(list, show) {
    const nav = $("nav"), bar = nav.querySelector(".wrap"); bar.replaceChildren(); nav.hidden = false;
    list.forEach(([key, label], i) => {
      const b = h("button", { role: "tab", "aria-selected": i === 0 ? "true" : "false", onclick: () => {
        bar.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
        show(key);
      } }, label);
      bar.append(b);
    });
    show(list[0][0]);
  }

  async function board(name, user, { canWrite }) {
    const isStaff = ["staff", "owner"].includes(user.role);
    const box = h("div", { style: "display:grid;gap:14px" });
    $("main").replaceChildren(box);
    if (canWrite) {
      const title = h("input", { maxlength: 80, placeholder: name === "meetup" ? "예: 11/2 광주 직관 (3자리 남음)" : "제목" });
      const body = h("textarea", { maxlength: 5000, placeholder: "내용" });
      box.append(h("section", { class: "card" }, h("h3", {}, BOARD_KO[name] + " 글쓰기"), title, body,
        h("div", { class: "row" }, h("button", { class: "btn primary", onclick: async () => {
          if (!title.value.trim()) return toast("제목을 적어 주세요");
          const { error } = await sb.from("posts").insert({ board: name, title: title.value.trim(), body: body.value.trim() });
          if (error) return fail(error);
          toast("올렸어요"); board(name, user, { canWrite });
        } }, "올리기"))));
    }
    const { data, error } = await sb.from("posts").select("id,title,body,pinned,created_at,author,profiles(nickname,kakao_name)")
      .eq("board", name).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) return fail(error);
    if (!data.length) box.append(h("p", { class: "hint" }, "아직 글이 없어요."));
    for (const p of data) {
      const mine = p.author === user.id;
      const tools = h("div", { class: "row" },
        isStaff && name === "notice" ? h("button", { class: "btn small", onclick: async () => {
          const { error } = await sb.from("posts").update({ pinned: !p.pinned }).eq("id", p.id);
          error ? fail(error) : board(name, user, { canWrite });
        } }, p.pinned ? "고정 해제" : "상단 고정") : null,
        mine || isStaff ? h("button", { class: "btn small danger", onclick: async () => {
          if (!confirm("이 글을 지울까요?")) return;
          const { error } = await sb.from("posts").delete().eq("id", p.id);
          error ? fail(error) : board(name, user, { canWrite });
        } }, "삭제") : null);
      box.append(h("article", { class: "card" },
        h("h3", {}, p.pinned ? h("span", { class: "pin" }, "📌") : null, p.title),
        h("div", { class: "meta" }, (p.profiles?.nickname || p.profiles?.kakao_name || "알 수 없음") + " · " + when(p.created_at)),
        p.body ? h("p", { class: "body" }, p.body) : null,
        tools.childElementCount ? tools : null));
    }
  }

  // 공통 시작: 로그인 확인 → 역할 확인 → 통과하면 onReady(user)
  async function start(title, allowed, onReady) {
    header(title, null);
    if (!sb) return setupScreen();
    const user = await me();
    if (!user) return loginScreen(title);
    header(title, user);
    if (user.role === "pending" || user.role === "banned") return waitScreen(user);
    if (!allowed.includes(user.role)) {
      return screen(h("section", { class: "card center" }, h("h2", {}, "운영진만 들어올 수 있어요"),
        h("a", { href: "../" }, "회원 사이트로 가기")));
    }
    onReady(user);
  }

  return { sb, h, $, toast, fail, when, roleTag, ROLE_KO, BOARD_KO, start, tabs, board, nicknameForm };
})();
