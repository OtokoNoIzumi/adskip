from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import uvicorn
import asyncio

app = FastAPI(title="广告识别API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 模拟数据库
detection_results = {}

@app.post("/api/detect")
async def detect_ads(request: Request):
    data = await request.json()
    video_id = data.get('videoId')
    subtitles = data.get('subtitles', [])

    print(f"收到检测请求: {video_id}")
    print(f"字幕数量: {len(subtitles)}")
    print(f"请求来源: {data.get('clientVersion', '未知')}, 自动检测: {data.get('autoDetect', False)}")

    if data.get('user'):
        print(f"用户信息: {data.get('user').get('username', '未知')}, UID: {data.get('user').get('uid', '未知')}")

    # 打印前三条字幕示例
    if subtitles:
        print(f"字幕示例(前3条): {subtitles[:3]}")

    for info in data:
        if info != 'subtitles':
            print(f"{info}: {data[info]}")

    # 检测逻辑
    has_ads = False
    ad_timestamps = []

    if subtitles:
        for subtitle in subtitles:
            content = subtitle.get('content', '')
            if '广告' in content or '赞助' in content or '支持' in content:
                start_time = subtitle.get('from', 0)
                end_time = start_time + 15  # 假设广告持续15秒

                ad_timestamps.append({
                    'start': start_time,
                    'end': end_time
                })
                has_ads = True

    # 保存检测结果
    detection_results[video_id] = {
        'hasAds': has_ads,
        'adTimestamps': ad_timestamps,
        'detectedAt': time.strftime('%Y-%m-%d %H:%M:%S')
    }

    # 模拟处理延迟
    await asyncio.sleep(2)

    return {
        'success': True,
        'hasAds': has_ads,
        'adTimestamps': ad_timestamps,
        'message': '检测到广告' if has_ads else '未检测到广告',
        'confidence': 0.95
    }

@app.get("/api/result/{video_id}")
async def get_result(video_id: str):
    if video_id in detection_results:
        return {
            'success': True,
            **detection_results[video_id]
        }
    else:
        return {
            'success': False,
            'message': '未找到该视频的检测结果'
        }

if __name__ == "__main__":
    uvicorn.run("api_fastapi:app", host="127.0.0.1", port=3000, reload=True)