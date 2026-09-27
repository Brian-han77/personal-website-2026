#!/usr/bin/env python3
"""Refresh the site's research snapshot from Do Heon's Google Scholar profile.

Google Scholar has no API and blocks browser requests from other sites, so the page shows a
saved snapshot (dist/data/research.json) instead of live numbers. Run this, then redeploy:

    python3 update-scholar.py

Scholar sometimes answers scripted requests with a CAPTCHA page; if so the script stops without
touching the snapshot, and trying again later usually works.
"""
import datetime
import html
import json
import pathlib
import re
import sys
import urllib.request

PROFILE = 'https://scholar.google.com/citations?user=2E-36fYAAAAJ&hl=en&pagesize=100'
OUT = pathlib.Path(__file__).parent / 'dist' / 'data' / 'research.json'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                         '(KHTML, like Gecko) Chrome/126 Safari/537.36',
           'Accept-Language': 'en-US,en;q=0.9'}


def text(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


def main():
    request = urllib.request.Request(PROFILE, headers=HEADERS)
    page = urllib.request.urlopen(request, timeout=30).read().decode('utf-8', 'ignore')
    if 'gsc_rsb_st' not in page:
        sys.exit('Google Scholar returned a CAPTCHA or an unexpected page; snapshot left unchanged.')

    # Citations / h-index / i10-index, "All" column.
    stats = [int(n) for n in re.findall(r'<td class="gsc_rsb_std">(\d+)</td>', page)]
    citations, h_index, i10 = stats[0], stats[2], stats[4]

    # Per-year bars: year labels run oldest to newest, and each bar's z-index counts back from the
    # newest year. Years with no citations have no bar.
    years = re.findall(r'<span class="gsc_g_t"[^>]*>(\d{4})</span>', page)
    per_year = {year: 0 for year in years}
    for z, value in re.findall(r'class="gsc_g_a"[^>]*z-index:(\d+)"><span class="gsc_g_al">(\d+)</span>', page):
        per_year[years[len(years) - int(z)]] = int(value)

    papers = []
    for row in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
        title = re.search(r'class="gsc_a_at"[^>]*>(.*?)</a>', row, re.S)
        grays = re.findall(r'<div class="gs_gray">(.*?)</div>', row, re.S)
        cited = re.search(r'class="gsc_a_ac[^"]*"[^>]*>(\d*)</a>', row)
        year = re.search(r'class="gsc_a_h[^"]*"[^>]*>(\d{4})</span>', row)
        link = re.search(r'href="(/citations\?view_op=view_citation[^"]+)"', row)
        papers.append({
            'title': text(title.group(1)) if title else '',
            'authors': text(grays[0]) if grays else '',
            'venue': re.sub(r',\s*\d{4}$', '', text(grays[1])) if len(grays) > 1 else '',
            'year': int(year.group(1)) if year else None,
            'citations': int(cited.group(1)) if cited and cited.group(1) else 0,
            'scholarUrl': 'https://scholar.google.com' + html.unescape(link.group(1)) if link else None,
        })

    snapshot = {
        'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'source': 'Google Scholar',
        'profile': PROFILE.split('&')[0],
        'citations': citations,
        'hIndex': h_index,
        'i10Index': i10,
        'perYear': per_year,
        'papers': papers,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=1, ensure_ascii=False) + '\n')
    print(f'{citations} citations, h-index {h_index}, {len(papers)} papers, per year {per_year}')
    for paper in papers:
        print(f"  {paper['citations']:>4}  {paper['title'][:80]}")


if __name__ == '__main__':
    main()
