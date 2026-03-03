import os
import glob

def get_file_size_kb(path):
    try:
        size = os.path.getsize(path)
        return round(size / 1024, 2)
    except:
        return 0

print("=" * 80)
print("拆分后的文档 (plans目录)")
print("=" * 80)
plans_files = glob.glob(r"D:\project\FICC-Brain\ficc-brain\.lane\plans\*.md")
plans_total = 0
for f in sorted(plans_files):
    if os.path.basename(f) not in ['architecture.md', 'data-model.md', 'spec.md', 'research.md', 'frontend_audit.md']:
        size = get_file_size_kb(f)
        plans_total += size
        print(f"{os.path.basename(f):<30} {size:>8} KB")

print("-" * 80)
print(f"{'拆分文档总计':<30} {plans_total:>8} KB")

print("\n" + "=" * 80)
print("原始大文档")
print("=" * 80)
original_files = [
    r"D:\project\FICC-Brain\ficc-brain\.lane\plans\architecture.md",
    r"D:\project\FICC-Brain\ficc-brain\.lane\plans\data-model.md",
    r"D:\project\FICC-Brain\ficc-brain\.lane\plans\spec.md",
    r"D:\project\FICC-Brain\ficc-brain\.lane\plans\research.md",
    r"D:\project\FICC-Brain\ficc-brain\.lane\plans\frontend_audit.md"
]
original_total = 0
for f in original_files:
    if os.path.exists(f):
        size = get_file_size_kb(f)
        original_total += size
        print(f"{os.path.basename(f):<30} {size:>8} KB")

print("-" * 80)
print(f"{'原始文档总计':<30} {original_total:>8} KB")

print("\n" + "=" * 80)
print(f"差异: {original_total - plans_total:.2f} KB")
print(f"原始文档是拆分文档的 {original_total/plans_total:.1f} 倍")
print("=" * 80)
