@echo off
chcp 65001

REM 1. 設定提交訊息
set COMMIT_MSG=%date%_%time%_update
echo 1. 使用提交訊息：%COMMIT_MSG%

REM 2. 設定遠端名稱
set REMOTE_NAME=origin 
echo 2. 遠端名稱：%REMOTE_NAME%

REM 3. 取得當前分支名稱
for /f %%b in ('git branch --show-current') do set BRANCH_NAME=%%b
echo 3. 當前分支名稱：%BRANCH_NAME%

REM 4. 添加變更
git add .
echo 4. 添加所有變更完成

REM 5. 提交變更
git commit -m "%COMMIT_MSG%"
echo 5. 提交完成

REM 6. 推送到遠端
git push %REMOTE_NAME% %BRANCH_NAME%
echo 6. 推送完成

echo 7. 完成！
pause