# 低血鉀症引導決策台

單一檔案的靜態網頁（`index.html`），用來逐步引導低血鉀症的緊急處置、病因鑑別與治療。

網址：<https://yht5582-source.github.io/hypokalemia/>

## 設計原則：資料不完整也能開始

- 初次接觸只需要血清鉀。系統依「先安全 → 再定位 → 後病因」的順序，在「下一步」卡片逐項提示該補的資料並說明理由，可在卡片內直接填寫。
- 檢驗已送出、尚未回報時，可標記「待回報」；系統會先用現有資料做暫定判斷，並繼續提示其他可以先做的事。
- 每補一項資料，緊急度、補鉀/補鎂計畫、病因鑑別、分層路徑與流程圖高亮都會同步更新，並留下時間紀錄；可一鍵複製摘要貼到病歷。
- 最終只確立一個主要病因（單選確認證據）；低鎂、轉移性藥物、攝取不足列為合併因素。確認證據與資料矛盾時會提示，不會直接定案。

## 分層

1. 確認與緊急度：K、症狀、ECG、橫紋肌溶解、假性低血鉀
2. 治療安全資料：Mg、eGFR/尿量、口服能力、靜脈路徑、心臟病/digoxin、肝硬化、DKA
3. 病史與用藥：嘔吐、腹瀉、利尿劑、轉移誘因、週期性麻痺、腎毒性藥物、甘草/azole、Cushing、家族史
4. 尿鉀定位：UK/UCr（>13 mEq/g 腎失鉀）或 24 h 尿鉀（>30 腎失鉀、<25 非腎性）
5. 酸鹼與血壓：HCO₃⁻、AG
6. 病因細分：尿氯、尿 pH、UAG、尿鈣、尿液利尿劑篩檢、腎素/醛固酮、甲狀腺
7. 確認證據

## 開發

決策邏輯集中在 `index.html` 的 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊，可在 Node 單獨測試：

```bash
node tests.cjs
```

## 主要參考

- UpToDate（Mount DB）：Evaluation of the adult patient with hypokalemia；Causes of hypokalemia in adults；Clinical manifestations and treatment of hypokalemia in adults（2025–2026 版）
- Endocrine Society. Primary Aldosteronism Clinical Practice Guideline, 2025
- ADA/EASD/JBDS/AACE/DTS. Hyperglycemic crises in adults with diabetes: consensus report. Diabetes Care 2024
- KDIGO Gitelman syndrome consensus, Kidney Int 2017
- StatPearls：Hypokalemia（2025）、Hyperaldosteronism（2025）

## 醫療安全聲明

本工具供醫療專業人員教育與流程輔助使用，不取代臨床判斷與院內規範。資料只存在使用者瀏覽器的 localStorage，不會上傳；請勿輸入可識別病人身分的資訊。
