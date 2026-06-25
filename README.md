# 低血鉀症互動診斷流程

這是一個純靜態互動網頁，用於低血鉀症的分層診斷與教育性治療建議。

## 功能

- 依血清鉀、症狀、心電圖先做危險分級。
- 要求必要資料後才進入下一層：尿鉀/肌酸酐比、24 小時尿鉀、酸鹼狀態、血壓、尿氯、血鎂、尿鈣、腎素/醛固酮。
- 分辨腎外流失、細胞內轉移、腎臟失鉀、RTA、利尿劑、Bartter、Gitelman、Liddle、原發性醛固酮增多症等方向。
- 顯示資料不足項目、目前分層路徑、可能診斷排序與補鉀/補鎂安全建議。

## GitHub Pages

此 repo 已包含靜態 `index.html` 與 Pages workflow。若 Pages 尚未啟用，請在 GitHub repo 的 Settings > Pages 將 Source 設為 GitHub Actions。

預期網址通常為：

<https://yht5582-source.github.io/hypokalemia/>

## 醫療安全聲明

本工具供醫療教育與流程設計使用，不取代臨床醫囑。實際處置需依病人腎功能、尿量、心電圖、輸液限制、併用藥物、院內規範與即時監測調整。

## 主要參考

- UpToDate PDFs provided by the user: causes, evaluation, manifestations/treatment of hypokalemia; metabolic alkalosis; primary aldosteronism.
- StatPearls/NCBI Bookshelf: Hypokalemia, updated Jan 19 2025. <https://www.ncbi.nlm.nih.gov/books/NBK482465/>
- American Family Physician: Potassium Disorders: Hypokalemia and Hyperkalemia, 2015. <https://www.aafp.org/pubs/afp/issues/2015/0915/p487.html>
- StatPearls/NCBI Bookshelf: Hyperaldosteronism, updated Jun 24 2025. <https://www.ncbi.nlm.nih.gov/books/NBK499983/>
