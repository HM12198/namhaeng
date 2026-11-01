"""KBO 공식 홈페이지에서 기아 타이거즈 경기 일정·결과를 받아 schedule.json 으로 저장한다.

경기 날짜·시간·상대·구장·중계·점수 같은 사실 정보만 담는다. GitHub Actions 가 몇 시간마다 실행한다.
사용: python scripts/fetch_schedule.py [출력 경로]
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

URL = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList"
KST = timezone(timedelta(hours=9))
TEAMS = {"LG": "LG 트윈스", "두산": "두산 베어스", "SSG": "SSG 랜더스", "키움": "키움 히어로즈", "KT": "KT 위즈",
         "NC": "NC 다이노스", "삼성": "삼성 라이온즈", "롯데": "롯데 자이언츠", "한화": "한화 이글스"}
PARKS = {"광주": "광주-기아 챔피언스 필드", "잠실": "잠실야구장", "문학": "인천 SSG 랜더스필드", "고척": "고척스카이돔",
         "수원": "수원 KT 위즈파크", "창원": "창원 NC 파크", "대구": "대구 삼성 라이온즈 파크", "사직": "사직야구장",
         "대전": "대전 한화생명 볼파크"}

TV = {"SPO-T": "SPOTV", "SPO-2T": "SPOTV2", "SS-T": "SBS Sports", "KN-T": "KBS N", "MS-T": "MBC SPORTS+",
      "M-T": "MBC", "S-T": "SBS", "K-1T": "KBS1", "K-2T": "KBS2", "K-T": "KBS", "T-T": "티빙"}


# 포스트시즌은 시리즈마다 따로 묻는다 (KBO 시리즈 번호)
SERIES = [("4", "와일드카드"), ("3", "준플레이오프"), ("5", "플레이오프"), ("7", "한국시리즈")]


def fetch(year, month, sr="0,9,6", team="HT"):
    data = urllib.parse.urlencode({"leId": "1", "srIdList": sr, "seasonId": str(year),
                                   "gameMonth": f"{month:02d}", "teamId": team}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "User-Agent": "Mozilla/5.0 (namhaeng-schedule/1.0)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.koreabaseball.com/Schedule/Schedule.aspx"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split()


def rows(year, blob):
    """KBO 표 한 줄 = [날짜(그날 첫 경기만), 시간, 경기, 게임센터, 하이라이트, TV, 라디오, 구장, 비고]"""
    out, day = [], None
    for r in blob.get("rows") or []:
        cells = r.get("row") or []
        by = {c.get("Class"): c.get("Text", "") for c in cells if c.get("Class")}
        if "day" in by:
            m = re.search(r"(\d{2})\.(\d{2})", by["day"])
            day = f"{year}-{m.group(1)}-{m.group(2)}" if m else None
        if not day or "play" not in by:
            continue
        play = re.sub(r"<em>.*?</em>", " vs ", by["play"], flags=re.S)
        teams = [t for t in text(play) if t != "vs"]
        if len(teams) != 2:
            continue
        scores = re.findall(r'<span class="(?:win|lose|same)">(\d+)</span>', by["play"])
        rest = [c.get("Text", "") for c in cells if not c.get("Class")]
        note = " ".join(text(rest[-1])) if rest else ""
        park = " ".join(text(rest[-2])) if len(rest) >= 2 else ""
        out.append({"date": day, "time": " ".join(text(by.get("time", ""))) or None,
                    "away": teams[0], "home": teams[1],
                    "scores": [int(x) for x in scores] if len(scores) == 2 else None,
                    "tv": ", ".join(TV.get(t, t) for t in text(rest[-4]))[:30] if len(rest) >= 4 else "",
                    "park": PARKS.get(park, park), "note": "" if note == "-" else note[:60]})
    return out


def kia(r, series=""):
    """기아 경기 한 줄 → 캘린더 형식 (점수는 기아:상대)"""
    home = r["home"] == "KIA"
    opp = r["away"] if home else r["home"]
    g = {"game_date": r["date"], "game_time": r["time"], "opp": TEAMS.get(opp, opp), "home": home,
         "park": r["park"], "tv": r["tv"], "result": "", "score": "", "note": r["note"], "series": series}
    if r["scores"]:
        a, h = r["scores"]
        k, o = (h, a) if home else (a, h)
        g["score"], g["result"] = f"{k}:{o}", "승" if k > o else "패" if k < o else "무"
    if "취소" in r["note"]:
        g["result"] = "취소"
    return g


def post(r, series):
    """포스트시즌 다른 팀 경기 (점수는 원정:홈)"""
    return {"game_date": r["date"], "game_time": r["time"], "series": series, "away": r["away"], "home": r["home"],
            "park": r["park"], "tv": r["tv"], "score": f"{r['scores'][0]}:{r['scores'][1]}" if r["scores"] else "",
            "note": r["note"]}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "schedule.json"
    now = datetime.now(KST)
    years = [now.year] + ([now.year + 1] if now.month >= 10 else [])
    games, ps, ok = [], [], 0
    for y in years:
        for m in range(3, 12):
            try:
                games += [kia(r) for r in rows(y, fetch(y, m)) if "KIA" in (r["away"], r["home"])]
                ok += 1
            except Exception as e:  # 한 달 실패해도 나머지는 계속
                print(f"{y}-{m:02d} 실패: {e}", file=sys.stderr)
            time.sleep(0.4)
        for sr, name in SERIES:  # 가을야구는 모든 팀 경기
            for m in (9, 10, 11):
                try:
                    for r in rows(y, fetch(y, m, sr, "")):
                        if "KIA" in (r["away"], r["home"]):
                            games.append(kia(r, name))
                        else:
                            ps.append(post(r, name))
                except Exception as e:
                    print(f"{y}-{m:02d} {name} 실패: {e}", file=sys.stderr)
                time.sleep(0.4)
    if not ok:
        sys.exit("KBO 일정을 하나도 못 가져왔어요. 기존 schedule.json 을 그대로 둡니다.")
    games.sort(key=lambda g: (g["game_date"], g["game_time"] or ""))
    ps.sort(key=lambda g: (g["game_date"], g["game_time"] or ""))
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"updated": now.isoformat(timespec="seconds"), "source": "KBO", "games": games, "postseason": ps},
                  f, ensure_ascii=False, indent=1)
    print(f"기아 {len(games)}경기, 가을야구(타팀) {len(ps)}경기 저장 ({ok}개월 성공)")
    for g in ps[:4] + ps[-2:]:
        print(g)
    for g in games[:3] + games[-3:]:
        print(g)


if __name__ == "__main__":
    main()
