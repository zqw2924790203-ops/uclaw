import os
import subprocess
import sys

# Get folder list from Python to ensure correct paths
all_items = os.listdir('F:\\')

# Build mapping by index (safer than hardcoding Chinese names)
# 2: idm乱码 -> 下载管理
# 3: vi乱码 -> 视频剪辑
# 4: 作业 -> 学习资料
# 5: 文档 -> 文档工具
# 6: 习题 -> 学习资料
# 7: 乱码 -> 需要检查
# 8: 乱码 -> 培训相关
# 9: 电影相关 -> 视频剪辑
# 10: 电影4K原版 -> 视频剪辑
# 11: 一生一世 -> 视频剪辑
# 12: 影片视频剪辑 -> 视频剪辑
# 14: 备份 -> 文档工具
# 22: sa -> 文档工具
# 25: monifeixing -> 已移动
# 26: x300pro -> 已移动
# 29: 工程项目建议学院 -> 学习资料

moves_needed = [
    (all_items[2], 'F:\\下载管理\\idm'),   # idm乱码
    (all_items[3], 'F:\\视频剪辑\\vi'),     # vi乱码
    (all_items[4], 'F:\\学习资料\\作业'),   # 作业
    (all_items[5], 'F:\\文档工具\\文档'),  # 文档
    (all_items[6], 'F:\\学习资料\\习题'),  # 习题
    (all_items[8], 'F:\\学习资料\\教育培训'),  # 乱码文件夹
    (all_items[9], 'F:\\视频剪辑\\电影相关'),   # 电影相关
    (all_items[10], 'F:\\视频剪辑\\电影4K'),  # 电影4K原版
    (all_items[11], 'F:\\视频剪辑\\一生一世'), # 一生一世
    (all_items[12], 'F:\\视频剪辑\\影片视频剪辑'), # 影片视频剪辑
    (all_items[14], 'F:\\文档工具\\备份'),   # 备份
    (all_items[22], 'F:\\文档工具\\sa'),    # sa
    (all_items[29], 'F:\\学习资料\\工程项目建议学院'), # 工程项目建议学院
]

print(f'Found {len(moves_needed)} folders to move')
sys.stdout.flush()

for i, (src, dst) in enumerate(moves_needed):
    try:
        full_src = os.path.join('F:\\', src)
        if os.path.exists(full_src):
            os.makedirs(dst, exist_ok=True)
            print(f'{i+1}/{len(moves_needed)}: Moving {src[:20]}...')
            sys.stdout.flush()
            result = subprocess.run(['robocopy', full_src, dst, '/MOVE', '/E'], 
                                capture_output=True, text=True, encoding='utf-8')
            print(f'{i+1}: Done, rc={result.returncode}')
            sys.stdout.flush()
        else:
            print(f'{i+1}: Not found - {src}')
            sys.stdout.flush()
    except Exception as e:
        print(f'{i+1}: Error - {e}')
        sys.stdout.flush()
