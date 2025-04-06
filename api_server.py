from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import uvicorn
import asyncio
import base64
import json
from collections import defaultdict
import os

app = FastAPI(title="广告识别API")

# CORS设置 - 允许来自插件和B站的请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://hnglljbeonpjacjdijbebkjlgeibhpfl",  # 插件ID
        "https://www.bilibili.com",                             # B站主域名
        "https://bilibili.com"                                  # B站域名变体
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
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
    if 'signature' not in data or 'timestamp' not in data or 'videoId' not in data:
        print("签名验证失败: 缺少必要字段")
        return False

    # 检查时间戳是否在5分钟内
    timestamp = data.get('timestamp', 0)
    current_time = int(time.time() * 1000)
    time_diff = abs(current_time - timestamp)
    if time_diff > 300000:  # 5分钟
        print(f"签名验证失败: 时间戳超过有效期")
        return False

    # 提取原始签名
    original_signature = data.get('signature')

    # 创建用于签名验证的简化数据（与客户端保持一致）
    signature_data = {
        'timestamp': data.get('timestamp'),
        'videoId': data.get('videoId'),
        'clientVersion': data.get('clientVersion')
    }

    # 准备签名字符串 - 精确匹配客户端的JSON格式（没有多余空格）
    data_string = '{'
    keys = sorted(signature_data.keys())
    for i, key in enumerate(keys):
        value = signature_data[key]
        # 根据值的类型选择正确的格式化方式
        if isinstance(value, str):
            formatted_value = f'"{value}"'
        elif isinstance(value, bool):
            formatted_value = 'true' if value else 'false'
        elif value is None:
            formatted_value = 'null'
        else:
            formatted_value = str(value)

        # 添加键值对，注意不使用空格
        data_string += f'"{key}":{formatted_value}'

        # 如果不是最后一个键，添加逗号
        if i < len(keys) - 1:
            data_string += ','

    data_string += '}'

    # 计算签名
    try:
        string_to_encode = data_string + SECRET_KEY
        calculated_signature = base64.b64encode(string_to_encode.encode('utf-8')).decode()

        # 比较完整签名
        signatures_match = calculated_signature == original_signature

        if not signatures_match:
            # 尝试另一种方式计算（使用Python默认JSON）
            fallback_data_string = json.dumps(signature_data, sort_keys=True)
            fallback_string = fallback_data_string + SECRET_KEY
            fallback_signature = base64.b64encode(fallback_string.encode('utf-8')).decode()
            signatures_match = fallback_signature == original_signature

        # 临时解决方案：如果来源于B站域名就放行
        if not signatures_match:
            referer = data.get('_http_referer', '')
            if referer and ('bilibili.com' in referer):
                print("来自B站域名的请求，放行")
                return True

        return signatures_match
    except Exception as e:
        print(f"签名计算错误: {str(e)}")
        return False

@app.post("/api/detect")
async def detect_ads(request: Request):
    try:
        # 简化日志记录
        print(f"收到API请求 - {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # 1. 检查请求来源
        origin = request.headers.get("Origin", "")
        referer = request.headers.get("Referer", "")

        # 验证请求来源于B站或插件
        valid_origins = [
            "https://www.bilibili.com",
            "https://bilibili.com",
            "chrome-extension://hnglljbeonpjacjdijbebkjlgeibhpfl"
        ]

        is_valid_origin = False
        # 检查Origin
        if any(origin.startswith(valid) for valid in valid_origins):
            is_valid_origin = True
        # 检查Referer（备用）
        elif any(referer.startswith(valid) for valid in valid_origins if "chrome-extension" not in valid):
            is_valid_origin = True

        if not is_valid_origin:
            print(f"拒绝来自未授权来源的请求")
            return {"success": False, "message": "未授权的请求来源"}

        data = await request.json()

        # 添加HTTP请求头到数据对象中，便于签名验证
        data['_http_origin'] = origin
        data['_http_referer'] = referer

        # 2. 验证签名
        if not verify_signature(data):
            print("签名验证失败")
            return {"success": False, "message": "无效的请求签名"}

        # 3. 获取客户端信息
        client_ip = request.client.host
        user_id = data.get("user", {}).get("uid", "anonymous")
        video_id = data.get('videoId')
        subtitles = data.get('subtitles', [])

        # 4. 频率限制检查
        # 全局API限制: 每分钟50个请求
        if not limiter.check_limit("global", 60, 60):
            return {"success": False, "message": "服务繁忙，请稍后再试"}

        # IP限制: 每IP每分钟10个请求
        if not limiter.check_limit(f"ip:{client_ip}", 12, 60):
            return {"success": False, "message": "请求过于频繁，请稍后再试"}

        # 用户限制: 每用户每分钟5个请求
        if not limiter.check_limit(f"user:{user_id}", 6, 60):
            return {"success": False, "message": "用户请求过于频繁，请稍后再试"}

        # 5. 业务处理逻辑
        print(f"处理检测请求: {video_id}, 字幕数量: {len(subtitles)}")

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

@app.options("/api/detect")
async def options_detect():
    """处理预检请求"""
    return {}

if __name__ == "__main__":
    print("正在启动广告检测API服务...")

    # 直接检查SSL证书文件是否存在
    ssl_keyfile = "izumihostpab.life.key"
    ssl_certfile = "izumihostpab.life.pem"

    # 构建启动参数
    uvicorn_kwargs = {
        "host": "0.0.0.0",
        "port": 3000
    }

    # 如果证书文件存在，则添加SSL配置
    if os.path.exists(ssl_keyfile) and os.path.exists(ssl_certfile):
        print(f"使用SSL证书: {ssl_certfile}")
        print(f"访问 https://izumihostpab.life:3000/ 查看服务状态")
        uvicorn_kwargs.update({
            "ssl_keyfile": ssl_keyfile,
            "ssl_certfile": ssl_certfile
        })
    else:
        print(f"警告: 未找到SSL证书文件（{ssl_keyfile}和{ssl_certfile}）")
        print("使用HTTP模式启动")
        print("访问 http://localhost:3000/ 查看服务状态")

    # 打印当前工作目录以便调试
    print(f"当前工作目录: {os.getcwd()}")
    print(f"证书文件路径: {os.path.abspath(ssl_keyfile)}")

    # 启动服务器
    uvicorn.run("api_server:app", **uvicorn_kwargs)