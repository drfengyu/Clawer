"""
API 测试脚本 - Python 版本
用于测试媒体资源爬虫管理系统的所有API接口
"""

import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def print_header(text):
    print("\n" + "=" * 60)
    print(f"   {text}")
    print("=" * 60 + "\n")

def print_step(step, total, text):
    print(f"[{step}/{total}] {text}")
    print("-" * 60)

def print_json(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def test_api():
    print_header("媒体资源爬虫系统 - API 测试")

    # 1. 测试统计信息
    print_step(1, 10, "测试获取统计信息")
    response = requests.get(f"{BASE_URL}/stats")
    print_json(response.json())

    # 2. 测试添加爬取任务
    print_step(2, 10, "测试添加爬取任务")
    response = requests.post(f"{BASE_URL}/crawl", json={
        "url": "http://example.com",
        "type": "image"
    })
    result = response.json()
    print_json(result)
    task_id = result['data']['id']
    print(f"✓ 任务ID: {task_id}\n")
    time.sleep(3)  # 等待任务处理

    # 3. 测试获取所有资源
    print_step(3, 10, "测试获取所有资源")
    response = requests.get(f"{BASE_URL}/resources")
    print_json(response.json())

    # 4. 测试根据ID获取资源
    print_step(4, 10, f"测试根据ID获取资源 (ID: {task_id})")
    response = requests.get(f"{BASE_URL}/resources/{task_id}")
    print_json(response.json())

    # 5. 测试根据类型获取资源
    print_step(5, 10, "测试根据类型获取资源 (type: image)")
    response = requests.get(f"{BASE_URL}/resources/type/image")
    print_json(response.json())

    # 6. 测试根据状态获取资源
    print_step(6, 10, "测试根据状态获取资源 (status: failed)")
    response = requests.get(f"{BASE_URL}/resources/status/failed")
    print_json(response.json())

    # 7. 测试搜索功能
    print_step(7, 10, "测试搜索功能 (关键词: example)")
    response = requests.get(f"{BASE_URL}/search", params={"q": "example"})
    print_json(response.json())

    # 8. 测试获取爬取历史
    print_step(8, 10, "测试获取爬取历史")
    response = requests.get(f"{BASE_URL}/history", params={"limit": 5})
    print_json(response.json())

    # 9. 测试获取下载信息
    print_step(9, 10, f"测试获取下载信息 (ID: {task_id})")
    response = requests.get(f"{BASE_URL}/download/{task_id}")
    print_json(response.json())

    # 10. 测试更新后的统计信息
    print_step(10, 10, "测试更新后的统计信息")
    response = requests.get(f"{BASE_URL}/stats")
    print_json(response.json())

    print_header("✓ 所有测试完成！")

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
