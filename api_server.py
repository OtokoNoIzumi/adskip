from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import time
import uvicorn
import asyncio
import base64
import json
from collections import defaultdict

app = FastAPI(title="广告识别API")

# CORS设置 - 允许插件ID和B站域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://hnglljbeonpjacjdijbebkjlgeibhpfl",  # 插件ID
        "https://www.bilibili.com",                            # B站主域名
        "https://bilibili.com",                                # B站域名变体
        "https://www.bilibili.tv",                             # 其他可能的B站域名
        "*",                                                   # 允许所有来源（开发测试用）
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,  # 预检请求缓存1天
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
    try:
        # 解决中文字符问题：使用与前端相同的编码方式
        string_to_encode = data_string + SECRET_KEY
        calculated_signature = base64.b64encode(string_to_encode.encode('utf-8')).decode()
    except Exception as e:
        print(f"签名计算错误: {str(e)}")
        data['signature'] = original_signature  # 恢复签名字段
        return False

    # 恢复签名字段
    data['signature'] = original_signature

    # 比较签名
    return calculated_signature == original_signature

@app.post("/api/detect")
async def detect_ads(request: Request):
    print("\n===================== 新的广告检测请求 =====================")
    print(f"客户端IP: {request.client.host}")
    print(f"请求头: {dict(request.headers)}")

    try:
        # 获取和记录请求体
        request_body = await request.body()
        if len(request_body) > 5000:
            print(f"请求体 (长度 {len(request_body)}): {request_body[:2000]}...{request_body[-2000:]}")
        else:
            print(f"请求体: {request_body}")

        # 解析JSON
        try:
            data = await request.json()
        except Exception as e:
            print(f"JSON解析错误: {str(e)}")
            return {"success": False, "message": f"无效的JSON格式: {str(e)}"}

        # 获取基本信息
        user_id = data.get("user", {}).get("uid", "anonymous")
        video_id = data.get('videoId')
        print(f"视频ID: {video_id}, 用户: {user_id}")

        # 验证签名 - 在测试阶段暂时可选
        signature_valid = verify_signature(data)
        print(f"签名验证结果: {'通过' if signature_valid else '失败'}")

        # 是否强制要求签名
        require_signature = False  # 开发阶段设置为False
        if require_signature and not signature_valid:
            print("签名验证失败，拒绝请求")
            return {"success": False, "message": "无效的请求签名"}

        # 获取客户端信息
        client_ip = request.client.host
        subtitles = data.get('subtitles', [])
        print(f"字幕数量: {len(subtitles)}")

        # 3. 频率限制检查 - 在测试阶段暂时关闭
        apply_rate_limits = False  # 开发阶段设置为False
        if apply_rate_limits:
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
        print(f"请求来源: {data.get('clientVersion', '未知')}, 自动检测: {data.get('autoDetect', False)}")

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

        result = {
            'success': True,
            'hasAds': has_ads,
            'adTimestamps': ad_timestamps,
            'message': '检测到广告' if has_ads else '未检测到广告',
            'confidence': 0.95
        }

        print(f"响应结果: {result}")
        print("===================== 请求处理完成 =====================\n")
        return result
    except Exception as e:
        print(f"处理请求出错: {str(e)}")
        import traceback
        print(f"错误堆栈: {traceback.format_exc()}")
        print("===================== 请求处理异常 =====================\n")
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

# 添加OPTIONS请求处理程序
@app.options("/api/detect")
async def options_api_detect():
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        }
    )

if __name__ == "__main__":
    print("正在启动广告检测API服务...")
    print("访问 https://localhost:3000/ 查看服务状态")

    # 使用uvicorn的HTTPS参数
    import ssl
    # 创建SSL上下文
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    # 使用自签名证书 - 这里会在当前目录下自动生成自签名证书
    from pathlib import Path

    cert_file = Path("server.crt")
    key_file = Path("server.key")

    # 如果证书不存在，自动生成自签名证书
    if not cert_file.exists() or not key_file.exists():
        print("正在生成自签名SSL证书...")
        from OpenSSL import crypto

        # 创建一个密钥对
        k = crypto.PKey()
        k.generate_key(crypto.TYPE_RSA, 2048)

        # 创建一个自签名证书
        cert = crypto.X509()
        cert.get_subject().CN = "localhost"
        cert.set_serial_number(1000)
        cert.gmtime_adj_notBefore(0)
        cert.gmtime_adj_notAfter(10*365*24*60*60)  # 10年有效期
        cert.set_issuer(cert.get_subject())
        cert.set_pubkey(k)
        cert.sign(k, 'sha256')

        # 写入文件
        with open(cert_file, "wb") as f:
            f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
        with open(key_file, "wb") as f:
            f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k))

        print(f"证书已生成: {cert_file}, {key_file}")

    ssl_context.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))

    # 启动带HTTPS的服务器
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=3000,
        ssl_keyfile=str(key_file),
        ssl_certfile=str(cert_file)
    )