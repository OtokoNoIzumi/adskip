from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import uvicorn
import asyncio
import base64
import json
from collections import defaultdict

app = FastAPI(title="广告识别API")

# CORS设置 - 限制只允许插件域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://hnglljbeonpjacjdijbebkjlgeibhpfl"],  # 仅限指定插件ID
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# 模拟数据库
detection_results = {}

# 内存限速器
class MemoryRateLimiter:
    def __init__(self):
        self.request_records = defaultdict(list)

    def check_limit(self, key, limit, window):
        """检查指定键是否超出限制"""
        current_time = time.time()
        # 清理过期记录
        self.request_records[key] = [t for t in self.request_records[key]
                                    if current_time - t < window]

        # 检查是否超出限制
        if len(self.request_records[key]) >= limit:
            return False

        # 记录本次请求
        self.request_records[key].append(current_time)
        return True

# 创建全局限速器
limiter = MemoryRateLimiter()

# 简单的请求签名验证
SECRET_KEY = "adskip_plugin_2024_secure_key"  # 设置一个安全的密钥

def verify_signature(data):
    """验证请求签名"""
    if 'signature' not in data or 'timestamp' not in data:
        return False

    # 检查时间戳是否在5分钟内
    timestamp = data.get('timestamp', 0)
    current_time = int(time.time() * 1000)
    if abs(current_time - timestamp) > 300000:  # 5分钟
        return False

    # 提取并移除签名以重新计算
    original_signature = data.pop('signature')

    # 准备要签名的字符串 - 确保排序一致性
    data_string = json.dumps(data, sort_keys=True)

    # 计算签名 - 与前端完全一致的方法
    calculated_signature = base64.b64encode((data_string + SECRET_KEY).encode()).decode()

    # 恢复签名字段
    data['signature'] = original_signature

    # 比较签名
    return calculated_signature == original_signature

@app.post("/api/detect")
async def detect_ads(request: Request):
    try:
        data = await request.json()

        # 1. 验证签名
        if not verify_signature(data):
            print("签名验证失败")
            return {"success": False, "message": "无效的请求签名"}

        # 2. 获取客户端信息
        client_ip = request.client.host
        user_id = data.get("user", {}).get("uid", "anonymous")
        video_id = data.get('videoId')
        subtitles = data.get('subtitles', [])

        # 3. 频率限制检查
        # 全局API限制: 每分钟50个请求
        if not limiter.check_limit("global", 60, 60):
            return {"success": False, "message": "服务繁忙，请稍后再试"}

        # IP限制: 每IP每分钟10个请求
        if not limiter.check_limit(f"ip:{client_ip}", 12, 60):
            return {"success": False, "message": "请求过于频繁，请稍后再试"}

        # 用户限制: 每用户每分钟5个请求
        if not limiter.check_limit(f"user:{user_id}", 6, 60):
            return {"success": False, "message": "用户请求过于频繁，请稍后再试"}

        # 4. 业务处理逻辑
        print(f"收到检测请求: {video_id}")
        print(f"字幕数量: {len(subtitles)}")
        print(f"请求来源: {data.get('clientVersion', '未知')}, 自动检测: {data.get('autoDetect', False)}")
        print(f"客户端IP: {client_ip}")

        if data.get('user'):
            print(f"用户信息: {data.get('user').get('username', '未知')}, UID: {data.get('user').get('uid', '未知')}")

        # 打印前三条字幕示例（如果有）
        if subtitles:
            print(f"字幕示例(前3条): {subtitles[:3]}")

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
        await asyncio.sleep(1)

        return {
            'success': True,
            'hasAds': has_ads,
            'adTimestamps': ad_timestamps,
            'message': '检测到广告' if has_ads else '未检测到广告',
            'confidence': 0.95
        }
    except Exception as e:
        print(f"处理请求出错: {str(e)}")
        return {"success": False, "message": f"服务器处理错误: {str(e)}"}

@app.get("/api/result/{video_id}")
async def get_result(video_id: str, request: Request):
    # 简单的IP限制检查
    client_ip = request.client.host
    if not limiter.check_limit(f"ip:{client_ip}", 20, 60):
        return {"success": False, "message": "请求过于频繁，请稍后再试"}

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

@app.get("/")
async def root():
    return {"message": "广告检测API服务正常运行中"}

if __name__ == "__main__":
    print("正在启动广告检测API服务...")
    print("访问 http://localhost:3000/ 查看服务状态")
    uvicorn.run("api_server:app", host="0.0.0.0", port=3000)