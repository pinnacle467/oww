#!/usr/bin/env python3
"""
AG1 Backend Test: HTTP Range-request support on /api/uploads
Tests video playback Range support + regression checks
"""

import requests
import sys

# Base URL for testing (internal backend port)
BASE_URL = "http://localhost:8001"

# Test video file (client-reported issue)
VIDEO_PATH = "/api/uploads/tour-gallery/13e6b94b8409444289cc9aeb2f6632bb.mp4"
VIDEO_SIZE = 3076922

# Test image file for regression
IMAGE_PATH = "/api/uploads/tour-gallery/90165a23d3864a97a416f8322cc3b88f.webp"

def test_1_no_range_video():
    """Test 1: NO-RANGE GET on mp4 → 200 OK with Accept-Ranges: bytes"""
    print("\n=== TEST 1: NO-RANGE GET on video ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    resp = requests.get(url, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    print(f"Accept-Ranges: {resp.headers.get('Accept-Ranges')}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    print(f"Cache-Control: {resp.headers.get('Cache-Control')}")
    print(f"ETag: {resp.headers.get('ETag')}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.headers.get('Content-Length') == str(VIDEO_SIZE), f"Expected Content-Length {VIDEO_SIZE}, got {resp.headers.get('Content-Length')}"
    assert resp.headers.get('Accept-Ranges') == 'bytes', f"Expected Accept-Ranges: bytes, got {resp.headers.get('Accept-Ranges')}"
    assert 'video' in resp.headers.get('Content-Type', '').lower(), f"Expected video Content-Type, got {resp.headers.get('Content-Type')}"
    assert 'immutable' in resp.headers.get('Cache-Control', '').lower(), f"Expected immutable in Cache-Control, got {resp.headers.get('Cache-Control')}"
    assert resp.headers.get('ETag') is not None, "Expected ETag header"
    
    print("✓ PASS: NO-RANGE GET returns 200 with Accept-Ranges: bytes")
    return True

def test_2_range_0_999():
    """Test 2: RANGE GET bytes=0-999 → 206 Partial Content"""
    print("\n=== TEST 2: RANGE GET bytes=0-999 ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=0-999'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    print(f"First 4 bytes (hex): {resp.content[:4].hex()}")
    
    assert resp.status_code == 206, f"Expected 206, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes 0-999/{VIDEO_SIZE}', f"Expected Content-Range bytes 0-999/{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    assert resp.headers.get('Content-Length') == '1000', f"Expected Content-Length 1000, got {resp.headers.get('Content-Length')}"
    assert len(resp.content) == 1000, f"Expected 1000 bytes, got {len(resp.content)}"
    
    # Verify first 4 bytes are ftyp atom start (00 00 00 18 or similar)
    first_4 = resp.content[:4]
    expected_start = b'\x00\x00'
    print(f"First 4 bytes match MP4 ftyp atom pattern: {first_4[0:2] == expected_start}")
    
    print("✓ PASS: RANGE bytes=0-999 returns 206 with correct slice")
    return True

def test_3_range_500000_600000():
    """Test 3: RANGE GET bytes=500000-600000 → 206"""
    print("\n=== TEST 3: RANGE GET bytes=500000-600000 ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=500000-600000'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    
    assert resp.status_code == 206, f"Expected 206, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes 500000-600000/{VIDEO_SIZE}', f"Expected Content-Range bytes 500000-600000/{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    assert resp.headers.get('Content-Length') == '100001', f"Expected Content-Length 100001, got {resp.headers.get('Content-Length')}"
    assert len(resp.content) == 100001, f"Expected 100001 bytes, got {len(resp.content)}"
    
    print("✓ PASS: RANGE bytes=500000-600000 returns 206 with correct slice")
    return True

def test_4_range_open_ended():
    """Test 4: RANGE GET bytes=500- (open-ended) → 206"""
    print("\n=== TEST 4: RANGE GET bytes=500- (open-ended) ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=500-'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    
    expected_length = VIDEO_SIZE - 500
    assert resp.status_code == 206, f"Expected 206, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes 500-{VIDEO_SIZE-1}/{VIDEO_SIZE}', f"Expected Content-Range bytes 500-{VIDEO_SIZE-1}/{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    assert resp.headers.get('Content-Length') == str(expected_length), f"Expected Content-Length {expected_length}, got {resp.headers.get('Content-Length')}"
    assert len(resp.content) == expected_length, f"Expected {expected_length} bytes, got {len(resp.content)}"
    
    print("✓ PASS: RANGE bytes=500- returns 206 with rest of file")
    return True

def test_5_range_suffix():
    """Test 5: RANGE GET bytes=-1024 (suffix) → 206"""
    print("\n=== TEST 5: RANGE GET bytes=-1024 (suffix) ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=-1024'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    
    expected_start = VIDEO_SIZE - 1024
    expected_end = VIDEO_SIZE - 1
    assert resp.status_code == 206, f"Expected 206, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes {expected_start}-{expected_end}/{VIDEO_SIZE}', f"Expected Content-Range bytes {expected_start}-{expected_end}/{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    assert resp.headers.get('Content-Length') == '1024', f"Expected Content-Length 1024, got {resp.headers.get('Content-Length')}"
    assert len(resp.content) == 1024, f"Expected 1024 bytes, got {len(resp.content)}"
    
    print("✓ PASS: RANGE bytes=-1024 returns 206 with last 1024 bytes")
    return True

def test_6_bad_range_beyond_eof():
    """Test 6: Bad Range bytes=99999999- (beyond EOF) → 416"""
    print("\n=== TEST 6: Bad Range bytes=99999999- (beyond EOF) ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=99999999-'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    
    assert resp.status_code == 416, f"Expected 416, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes */{VIDEO_SIZE}', f"Expected Content-Range bytes */{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    
    print("✓ PASS: Bad Range beyond EOF returns 416")
    return True

def test_7_malformed_range():
    """Test 7: Malformed Range bytes=abc → 416"""
    print("\n=== TEST 7: Malformed Range bytes=abc ===")
    url = f"{BASE_URL}{VIDEO_PATH}"
    headers = {'Range': 'bytes=abc'}
    resp = requests.get(url, headers=headers, timeout=30)
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    
    assert resp.status_code == 416, f"Expected 416, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes */{VIDEO_SIZE}', f"Expected Content-Range bytes */{VIDEO_SIZE}, got {resp.headers.get('Content-Range')}"
    
    print("✓ PASS: Malformed Range returns 416")
    return True

def test_8_regression_images():
    """Test 8: Regression on IMAGES (webp) with and without Range"""
    print("\n=== TEST 8: Regression on IMAGES ===")
    url = f"{BASE_URL}{IMAGE_PATH}"
    
    # 8a: Without Range
    print("\n8a: Without Range header")
    resp = requests.get(url, timeout=30)
    print(f"Status: {resp.status_code}")
    print(f"Accept-Ranges: {resp.headers.get('Accept-Ranges')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.headers.get('Accept-Ranges') == 'bytes', f"Expected Accept-Ranges: bytes, got {resp.headers.get('Accept-Ranges')}"
    image_size = int(resp.headers.get('Content-Length', 0))
    assert image_size > 0, "Expected non-zero Content-Length"
    print(f"✓ Image size: {image_size} bytes")
    
    # 8b: With Range bytes=0-100
    print("\n8b: With Range bytes=0-100")
    headers = {'Range': 'bytes=0-100'}
    resp = requests.get(url, headers=headers, timeout=30)
    print(f"Status: {resp.status_code}")
    print(f"Content-Range: {resp.headers.get('Content-Range')}")
    print(f"Content-Length: {resp.headers.get('Content-Length')}")
    
    assert resp.status_code == 206, f"Expected 206, got {resp.status_code}"
    assert resp.headers.get('Content-Range') == f'bytes 0-100/{image_size}', f"Expected Content-Range bytes 0-100/{image_size}, got {resp.headers.get('Content-Range')}"
    assert resp.headers.get('Content-Length') == '101', f"Expected Content-Length 101, got {resp.headers.get('Content-Length')}"
    assert len(resp.content) == 101, f"Expected 101 bytes, got {len(resp.content)}"
    
    print("✓ PASS: Image Range requests working correctly")
    return True

def test_9_regression_api_endpoints():
    """Test 9: Regression sanity on other API endpoints"""
    print("\n=== TEST 9: Regression sanity on API endpoints ===")
    
    endpoints = [
        ('/api/media', 300, 'array'),
        ('/api/journeys', 4, 'array'),
        ('/api/content', 220, 'dict'),
        ('/api/settings', 15, 'dict'),
        ('/api/stories', 1, 'array'),
        ('/api/blog', 1, 'array'),
        ('/api/home-sections', 4, 'array'),
        ('/api/home-faqs', 9, 'array'),
    ]
    
    for path, min_count, expected_type in endpoints:
        url = f"{BASE_URL}{path}"
        resp = requests.get(url, timeout=30)
        print(f"\n{path}: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200 for {path}, got {resp.status_code}"
        
        data = resp.json()
        if expected_type == 'array':
            assert isinstance(data, list), f"Expected array for {path}, got {type(data)}"
            count = len(data)
            print(f"  Count: {count} (expected >= {min_count})")
            assert count >= min_count, f"Expected at least {min_count} items for {path}, got {count}"
        elif expected_type == 'dict':
            assert isinstance(data, dict), f"Expected dict for {path}, got {type(data)}"
            count = len(data)
            print(f"  Keys: {count} (expected >= {min_count})")
            assert count >= min_count, f"Expected at least {min_count} keys for {path}, got {count}"
    
    print("\n✓ PASS: All API endpoints responding correctly")
    return True

def main():
    print("=" * 80)
    print("AG1 Backend Test: HTTP Range-request support on /api/uploads")
    print("=" * 80)
    
    tests = [
        test_1_no_range_video,
        test_2_range_0_999,
        test_3_range_500000_600000,
        test_4_range_open_ended,
        test_5_range_suffix,
        test_6_bad_range_beyond_eof,
        test_7_malformed_range,
        test_8_regression_images,
        test_9_regression_api_endpoints,
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"✗ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {e}")
            failed += 1
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 80)
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED - AG1 Range-request support is working correctly")
        sys.exit(0)

if __name__ == "__main__":
    main()
