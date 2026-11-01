"""기아 타이거즈 기사 제목·언론사·시간·원문 링크만 모아 news.json 으로 저장한다.

본문은 저장하지 않는다(저작권). GitHub Actions 가 몇 시간마다 실행한다.
사용: python scripts/fetch_news.py [출력 경로] [RSS 파일(테스트용)]
"""
import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

QUERIES = ["기아 타이거즈", "KIA 타이거즈"]
KEEP = 40          # 남겨 둘 기사 수
MAX_AGE_DAYS = 7   # 이보다 오래된 기사는 버림


def feed_url(q):
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": q + " when:7d", "hl": "ko", "gl": "KR", "ceid": "KR:ko"})


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "namhaeng-news/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def parse(xml_bytes):
    items = []
    for it in ET.fromstring(xml_bytes).iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src = (it.findtext("source") or "").strip()
        if not title or not link.startswith("https://"):
            continue
        # 구글 뉴스 제목은 "기사 제목 - 언론사" 꼴이라 언론사 꼬리를 뗀다
        if src and title.endswith(" - " + src):
            title = title[: -len(" - " + src)]
        try:
            when = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
        items.append({"title": title, "source": src, "link": link, "time": when.isoformat()})
    return items


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "news.json"
    if len(sys.argv) > 2:
        raw = [open(sys.argv[2], "rb").read()]
    else:
        raw = [fetch(feed_url(q)) for q in QUERIES]

    now = datetime.now(timezone.utc)
    seen, items = set(), []
    for blob in raw:
        for a in parse(blob):
            key = a["title"].replace(" ", "")
            age = (now - datetime.fromisoformat(a["time"])).days
            if key in seen or age > MAX_AGE_DAYS:
                continue
            seen.add(key)
            items.append(a)
    items.sort(key=lambda a: a["time"], reverse=True)
    if not items:
        sys.exit("기사를 하나도 못 가져왔어요. 기존 news.json 을 그대로 둡니다.")

    with open(out, "w", encoding="utf-8") as f:
        json.dump({"updated": now.isoformat(timespec="seconds"), "items": items[:KEEP]},
                  f, ensure_ascii=False, indent=1)
    print(f"{len(items[:KEEP])}개 저장")


if __name__ == "__main__":
    main()
