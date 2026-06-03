#!/bin/bash

# API 测试脚本
# 用于测试媒体资源爬虫管理系统的所有API接口

BASE_URL="http://localhost:3000/api"

echo "========================================"
echo "   媒体资源爬虫系统 - API 测试"
echo "========================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 测试统计信息
echo -e "${BLUE}[1/10]${NC} 测试获取统计信息..."
curl -s "$BASE_URL/stats" | python -m json.tool
echo ""
echo ""

# 2. 测试添加爬取任务
echo -e "${BLUE}[2/10]${NC} 测试添加爬取任务..."
RESULT=$(curl -s -X POST "$BASE_URL/crawl" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example.com","type":"image"}')
echo "$RESULT" | python -m json.tool
TASK_ID=$(echo "$RESULT" | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo -e "${GREEN}✓${NC} 任务ID: $TASK_ID"
echo ""
sleep 3  # 等待任务处理

# 3. 测试获取所有资源
echo -e "${BLUE}[3/10]${NC} 测试获取所有资源..."
curl -s "$BASE_URL/resources" | python -m json.tool
echo ""
echo ""

# 4. 测试根据ID获取资源
echo -e "${BLUE}[4/10]${NC} 测试根据ID获取资源 (ID: $TASK_ID)..."
curl -s "$BASE_URL/resources/$TASK_ID" | python -m json.tool
echo ""
echo ""

# 5. 测试根据类型获取资源
echo -e "${BLUE}[5/10]${NC} 测试根据类型获取资源 (type: image)..."
curl -s "$BASE_URL/resources/type/image" | python -m json.tool
echo ""
echo ""

# 6. 测试根据状态获取资源
echo -e "${BLUE}[6/10]${NC} 测试根据状态获取资源 (status: failed)..."
curl -s "$BASE_URL/resources/status/failed" | python -m json.tool
echo ""
echo ""

# 7. 测试搜索功能
echo -e "${BLUE}[7/10]${NC} 测试搜索功能 (关键词: example)..."
curl -s "$BASE_URL/search?q=example" | python -m json.tool
echo ""
echo ""

# 8. 测试获取爬取历史
echo -e "${BLUE}[8/10]${NC} 测试获取爬取历史..."
curl -s "$BASE_URL/history?limit=5" | python -m json.tool
echo ""
echo ""

# 9. 测试获取下载信息
echo -e "${BLUE}[9/10]${NC} 测试获取下载信息 (ID: $TASK_ID)..."
curl -s "$BASE_URL/download/$TASK_ID" | python -m json.tool
echo ""
echo ""

# 10. 测试更新后的统计信息
echo -e "${BLUE}[10/10]${NC} 测试更新后的统计信息..."
curl -s "$BASE_URL/stats" | python -m json.tool
echo ""
echo ""

echo "========================================"
echo -e "${GREEN}✓ 所有测试完成！${NC}"
echo "========================================"
