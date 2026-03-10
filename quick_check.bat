@echo off
cd /d "%~dp0"
set PYTHONPATH=%CD%;%CD%\lib
"%CD%\python-3.9-embed\python.exe" -c "import sqlite3; conn = sqlite3.connect('database/shengxintou.db'); c = conn.cursor(); c.execute('SELECT agency, COUNT(*) FROM backend_conversions GROUP BY agency ORDER BY COUNT(*) DESC LIMIT 20'); print('Agency distribution:'); [print(f'  {r[0]}: {r[1]}') for r in c.fetchall()]; conn.close()"
pause