// 갤러리: 사진은 Supabase Storage 비공개 버킷 "gallery" 의 <내 id>/... 에 올리고,
// 글(posts.meta.photos)에는 경로만 둔다. 볼 때는 회원만 받는 1시간짜리 서명 링크를 쓴다.
// 올리기 전에 브라우저에서 큰 사진(긴 변 1600px)과 썸네일(480px)로 줄여 무료 용량을 아낀다.
const Gallery = (() => {
  const { sb, h, toast } = NH;
  const BUCKET = "gallery", MAX = 10, BIG = 1600, THUMB = 480;
  const TAGS = ["직관", "티관", "술자리·번개", "굿즈", "기타"];
  const store = () => sb.storage.from(BUCKET);

  // 서명 링크 (같은 화면에서 여러 번 부르지 않게 잠깐 기억)
  const cache = new Map();
  // 저장소 경로 대신 사이트 안 주소(assets/...)를 쓴 사진도 있다 (방장이 올린 배너 등)
  const isUrl = p => /^(assets\/|https:\/\/)/.test(p);
  async function urls(paths) {
    const need = paths.filter(p => !cache.has(p) && !isUrl(p));
    if (need.length) {
      const { data, error } = await store().createSignedUrls(need, 3600);
      if (error) console.error(error);
      (data || []).forEach(d => d.signedUrl && cache.set(d.path, d.signedUrl));
    }
    return paths.map(p => isUrl(p) ? p : cache.get(p) || "");
  }

  function shrink(file, size) {
    return new Promise((ok, no) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, size / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok({ blob: b, w: c.width, h: c.height }) : no(new Error("변환 실패")), "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error("사진을 읽지 못했어요")); };
      img.src = url;
    });
  }

  // 글쓰기 칸: 분류 + 사진 고르기 + 미리보기 (수정이면 기존 사진도 보여 주고 뺄 수 있다)
  function picker(userId, m = {}) {
    let keep = [...(m.photos || [])], fresh = [];
    const tag = h("select", {}, TAGS.map(t => h("option", { value: t, selected: t === m.tag }, t)));
    const file = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
    const grid = h("div", { class: "pick-grid" });
    const count = h("span", { class: "hint" });
    const draw = async () => {
      const old = await urls(keep.map(x => x.t));
      grid.replaceChildren(
        ...keep.map((x, i) => h("figure", {}, h("img", { src: old[i], alt: "" }),
          h("button", { type: "button", class: "x", title: "빼기", onclick: () => { keep.splice(i, 1); draw(); } }, "×"))),
        ...fresh.map((f, i) => h("figure", {}, h("img", { src: f.preview, alt: "" }),
          h("button", { type: "button", class: "x", title: "빼기", onclick: () => { URL.revokeObjectURL(f.preview); fresh.splice(i, 1); draw(); } }, "×"))),
        keep.length + fresh.length < MAX ? h("button", { type: "button", class: "pick-add", onclick: () => file.click() }, "＋ 사진") : null);
      count.textContent = `${keep.length + fresh.length} / ${MAX}장`;
    };
    file.addEventListener("change", () => {
      const room = MAX - keep.length - fresh.length;
      const picked = [...file.files].filter(f => f.type.startsWith("image/"));
      if (picked.length > room) toast(`사진은 ${MAX}장까지예요`);
      picked.slice(0, room).forEach(f => fresh.push({ file: f, preview: URL.createObjectURL(f) }));
      file.value = ""; draw();
    });
    const box = h("section", { class: "mate-form gallery-form" },
      h("div", { class: "row" }, h("label", { class: "field" }, h("span", { class: "lab" }, "📷 분류"), tag), count),
      grid, file, h("p", { class: "hint" }, "사진은 자동으로 줄여서 올라가요. 회원만 볼 수 있어요."));
    draw();
    box.count = () => keep.length + fresh.length;
    box.tag = () => tag.value;
    // 새 사진을 올리고 meta 를 돌려준다. removed = 수정 때 뺀 기존 사진
    box.save = async onStep => {
      const out = [...keep];
      for (const [i, f] of fresh.entries()) {
        onStep?.(`사진 올리는 중 ${i + 1}/${fresh.length}`);
        const [big, small] = await Promise.all([shrink(f.file, BIG), shrink(f.file, THUMB)]);
        const base = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        for (const [path, b] of [[base + ".jpg", big], [base + "-t.jpg", small]]) {
          const { error } = await store().upload(path, b.blob, { contentType: "image/jpeg", upsert: false });
          if (error) throw error;
        }
        out.push({ p: base + ".jpg", t: base + "-t.jpg", w: big.w, h: big.h });
      }
      const removed = (m.photos || []).filter(x => !keep.includes(x));
      return { meta: { tag: tag.value, photos: out }, removed };
    };
    return box;
  }

  async function remove(photos) {
    const paths = (photos || []).flatMap(x => [x.p, x.t]).filter(p => !isUrl(p));
    if (paths.length) { const { error } = await store().remove(paths); if (error) console.error(error); }
  }

  // 목록: 사진 바둑판
  function grid(posts, authorName) {
    const box = h("div", { class: "gal-grid" });
    (async () => {
      const src = await urls(posts.map(p => p.meta?.photos?.[0]?.t).filter(Boolean));
      let k = 0;
      box.replaceChildren(...posts.map(p => {
        const first = p.meta?.photos?.[0], n = p.meta?.photos?.length || 0;
        return h("a", { class: "gal-card", href: "#post/" + p.id },
          h("div", { class: "gal-thumb" }, first ? h("img", { src: src[k++], alt: "", loading: "lazy" }) : h("span", {}, "📷"),
            n > 1 ? h("span", { class: "gal-n" }, "+" + (n - 1)) : null,
            p.meta?.tag ? h("span", { class: "gal-tag" }, p.meta.tag) : null),
          h("div", { class: "gal-title" }, p.title, p.comments?.[0]?.count ? h("span", { class: "cnt-cm" }, ` [${p.comments[0].count}]`) : null),
          h("div", { class: "gal-by" }, authorName(p)));
      }));
    })();
    return box;
  }

  // 글 보기: 큰 사진을 차례로. 누르면 원본 크기로 새 탭
  function photos(meta) {
    const box = h("div", { class: "gal-photos" });
    const list = meta?.photos || [];
    urls(list.map(x => x.p)).then(src => box.replaceChildren(...list.map((x, i) =>
      h("a", { href: src[i], target: "_blank", rel: "noopener" },
        h("img", { src: src[i], alt: `사진 ${i + 1}`, width: x.w, height: x.h, loading: "lazy" })))));
    return box;
  }

  return { TAGS, picker, grid, photos, remove };
})();
