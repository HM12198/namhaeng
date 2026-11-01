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


def fetch(year, month):
    data = urllib.parse.urlencode({"leId": "1", "srIdList": "0,9,6", "seasonId": str(year),
                                   "gameMonth": f"{month:02d}", "teamId": "HT"}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "User-Agent": "Mozilla/5.0 (namhaeng-schedule/1.0)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.koreabaseball.com/Schedule/Schedule.aspx"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split()


def parse(year, blob):
    """KBO 표 한 줄 = [날짜(첫 경기만), 시간, 경기, 게임센터, 하이라이트, TV, 라디오, 구장, 비고]"""
    games, day = [], None
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
        if len(teams) != 2 or "KIA" not in teams:
            continue
        away, home = teams
        scores = re.findall(r'<span class="(?:win|lose|same)">(\d+)</span>', by["play"])
        rest = [c.get("Text", "") for c in cells if not c.get("Class")]
        tv = ", ".join(TV.get(t, t) for t in text(rest[-4])) if len(rest) >= 4 else ""   # 끝에서부터 TV, 라디오, 구장, 비고
        park = " ".join(text(rest[-2])) if len(rest) >= 2 else ""
        note = " ".join(text(rest[-1])) if rest else ""
        g = {"game_date": day, "game_time": " ".join(text(by.get("time", ""))) or None,
             "opp": TEAMS.get(away if home == "KIA" else home, away if home == "KIA" else home),
             "home": home == "KIA", "park": PARKS.get(park, park), "tv": tv[:30],
             "result": "", "score": "", "note": note[:60] if note != "-" else ""}
        if len(scores) == 2:
            a, h = int(scores[0]), int(scores[1])
            kia, opp = (h, a) if g["home"] else (a, h)
            g["score"] = f"{kia}:{opp}"
            g["result"] = "승" if kia > opp else "패" if kia < opp else "무"
        if "취소" in note:
            g["result"] = "취소"
        games.append(g)
    return games


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "schedule.json"
    now = datetime.now(KST)
    years = [now.year] + ([now.year + 1] if now.month >= 10 else [])
    games, ok = [], 0
    for y in years:
        for m in range(3, 12):
            try:
                games += parse(y, fetch(y, m))
                ok += 1
            except Exception as e:  # 한 달 실패해도 나머지는 계속
                print(f"{y}-{m:02d} 실패: {e}", file=sys.stderr)
            time.sleep(0.5)
    if not ok:
        sys.exit("KBO 일정을 하나도 못 가져왔어요. 기존 schedule.json 을 그대로 둡니다.")
    games.sort(key=lambda g: (g["game_date"], g["game_time"] or ""))
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"updated": now.isoformat(timespec="seconds"), "source": "KBO", "games": games},
                  f, ensure_ascii=False, indent=1)
    print(f"{len(games)}경기 저장 ({ok}개월 성공)")
    for g in games[:3] + games[-3:]:
        print(g)


if __name__ == "__main__":
    main()
