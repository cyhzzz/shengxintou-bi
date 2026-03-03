import pandas as pd

file1 = r'D:\project\FICC-Brain\参考\余额&发生额&押品中间表20260225 - 字段版.xlsx'
df1 = pd.read_excel(file1, sheet_name=None)
output = []
output.append('=== 文件1: 余额&发生额&押品中间表 ===')
output.append(f'Sheet列表: {list(df1.keys())}')
for sheet_name, df in df1.items():
    output.append(f'\n--- Sheet: {sheet_name} ---')
    output.append(f'行数: {len(df)}, 列数: {len(df.columns)}')
    output.append(f'列名: {list(df.columns)}')
    output.append(df.to_string())

output.append('\n\n')

file2 = r'D:\project\FICC-Brain\参考\资金营运中心考核损益中间表20260225 - 字段版.xlsx'
df2 = pd.read_excel(file2, sheet_name=None)
output.append('=== 文件2: 资金营运中心考核损益中间表 ===')
output.append(f'Sheet列表: {list(df2.keys())}')
for sheet_name, df in df2.items():
    output.append(f'\n--- Sheet: {sheet_name} ---')
    output.append(f'行数: {len(df)}, 列数: {len(df.columns)}')
    output.append(f'列名: {list(df.columns)}')
    output.append(df.to_string())

with open(r'D:\project\FICC-Brain\excel_content.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print('Done! Output saved to excel_content.txt')
