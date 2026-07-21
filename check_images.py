import urllib.request

urls = [
    "https://image.tmdb.org/t/p/w500/A0SAeKMFVvvSMilgyBfSVKMJMKb.jpg",
    "https://image.tmdb.org/t/p/w1280/nJFSd7wL8kPVEYZjYqNjgFosFsl.jpg",
    "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW73FFC0SD4Y.jpg",
    "https://image.tmdb.org/t/p/w1280/gc8PfyTqzqltKMELMmMmKHHmMFb.jpg"
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        print(f"OK: {url}")
    except Exception as e:
        print(f"FAIL: {url} - {e}")
