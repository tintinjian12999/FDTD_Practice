import type { LessonDetail } from "./types";

export const numericsEngineeringDetails: Record<string, LessonDetail> = {
  "courant-dispersion": {
    prerequisites: ["知道 Δx 是空間取樣間距、Δt 是時間步", "能區分穩定性與準確度"],
    concepts: [
      {
        title: "Courant number 是離散因果比例",
        paragraphs: [
          "Sc=cΔt/Δx 表示真空光速在一個 time step 內走過多少個 cell。FDTD stencil 每次只能把資訊傳給相鄰格點；一維顯式 Yee scheme 因此要求 Sc≤1，讓數值資訊傳遞能力不落後於模型要求。",
        ],
        equation: "S_c=\frac{c\Delta t}{\Delta x}\le 1",
      },
      {
        title: "Sc<1 不代表能量被減少",
        paragraphs: [
          "降低 Sc 通常代表在相同 Δx 下使用更小 Δt。場每一步走得較短，需要更多 step 才到達同一位置；這是時間取樣改變，不是人工衰減。若比較牆鐘動畫而不是 step，很容易誤判速度。",
        ],
      },
      {
        title: "穩定仍可能色散",
        paragraphs: [
          "連續無色散介質中所有頻率以同一速度傳播；離散網格的相速度則依頻率與每波長格數改變。Gaussian 包含一段頻譜，網格過粗時各頻率逐漸分離，脈衝會變寬或振鈴，即使 Sc 完全穩定。",
          "一維真空在 Sc=1 是特殊情形，數值 dispersion relation 可精確匹配；加入材料、改變 Sc 或進入高維後不能延伸這個結論。",
        ],
        equation: "\sin\left(\frac{\omega\Delta t}{2}\right)=S_c\sin\left(\frac{k\Delta x}{2}\right)",
      },
    ],
    workedExample: {
      title: "由 SI 網格計算安全時間步",
      given: ["Δx=1 mm", "c=2.9979×10^8 m/s", "目標 Sc=0.9"],
      steps: ["將 Δx 換成 1×10^-3 m。", "使用 Δt=ScΔx/c。", "得到 Δt≈3.002×10^-12 s，也就是約 3.00 ps。"],
      result: "若 Δt 超過 3.336 ps，Sc 便大於 1；穩定性問題與 source 振幅無關。",
    },
    codeBridge: {
      title: "配置階段先拒絕不穩定參數",
      explanation: "正常模式不應等到場爆炸才發現 Sc 超界；教學模式才顯式允許並設安全門檻。",
      snippet: `double courant = c0 * dt / dx;
if (courant <= 0.0 ||
    (courant > 1.0 && !allow_unstable)) {
    return FDTD1D_INVALID_ARGUMENT;
}`,
    },
    experiment: {
      goal: "分別觀察 Sc<1 的延遲與 Sc>1 的不穩定成長。",
      setup: ["Source 選 Additive，因 TFSF 目前固定 Sc=1", "兩端 Mur1", "固定 Y 軸"],
      steps: ["以 Sc=0.9 記錄 probe 峰值 step。", "以 Sc=0.5 重設並記錄相同量。", "勾選允許受控 Sc>1，設定 1.05。", "播放直到核心由 maximum-field guard 停止。"],
      expected: ["Sc=0.5 的到達 step 約為 Sc=1 的兩倍。", "Sc=1.05 的小誤差模態呈指數成長，不只是波走得更快。"],
      successCriteria: ["能用 distance/Sc 預測到達 step", "能區分穩定波形變形與不穩定發散"],
    },
    misconceptions: [
      { claim: "Sc 越小越準確。", correction: "較小 Δt 降低時間誤差，但空間色散仍由 Δx/λ 控制，成本也增加。" },
      { claim: "Sc>1 只是超光速。", correction: "它破壞顯式 stencil 的穩定條件，通常導致非物理指數發散。" },
    ],
    selfChecks: [
      { question: "固定 Δx 時把 Δt 減半，Sc 如何變？", answer: "Sc 減半；到達相同位置需要約兩倍 time steps。" },
      { question: "Sc=0.8 且模擬穩定，能否證明波速準確？", answer: "不能；仍要檢查每波長格數與離散 dispersion relation。" },
    ],
  },

  scale: {
    prerequisites: ["能計算 Courant number", "知道頻率、波長與介質速度的關係"],
    concepts: [
      {
        title: "Normalized 模擬保留無因次結構",
        paragraphs: [
          "若 source delay、width、材料相對參數、Sc 與幾何 cell 數都相同，FDTD 陣列的演化不需要先指定公尺與秒。這種 normalized 描述適合推導、回歸測試與比較演算法。",
        ],
      },
      {
        title: "SI 模式把 cell 映射到實際長度",
        paragraphs: [
          "選定 Δx 後，index m 對應 x=mΔx；選定 Δt 後，step q 對應 t=qΔt。材料 εr、μr 保持無因次，但 conductivity 具有 SI 單位，source 的 step-domain 寬度也可換算為秒。",
          "SI 不是另一套物理核心。只要無因次參數一致，normalized 與 SI 應產生相同的場陣列。這項等價性是重要 regression test。",
        ],
      },
      {
        title: "由最高頻率反推 Δx",
        paragraphs: [
          "先找模型中最短波長，通常出現在最高關注頻率與最高折射率材料。再選每波長格數 Nλ；入門可從 20 cells/λ 開始，要求高相位精度時需做收斂分析，而不是把 20 當成普遍保證。",
        ],
        equation: "\lambda_{min}=\frac{c}{f_{max}\sqrt{\epsilon_r\mu_r}},\qquad \Delta x\le\frac{\lambda_{min}}{N_\lambda}",
      },
    ],
    workedExample: {
      title: "為 10 GHz、εr=4 選擇網格",
      given: ["fmax=10 GHz", "εr,max=4", "μr=1", "目標 20 cells/λ"],
      steps: ["介質速度為 c/2。", "最短波長 λmin=(c/2)/10 GHz≈15 mm。", "Δx≤15 mm/20=0.75 mm；若 Sc=0.9，Δt≤2.25 ps。"],
      result: "應先由介質中的最短波長選 Δx，再由穩定條件選 Δt，順序不能反過來。",
    },
    codeBridge: {
      title: "SI constructor 只解析尺度",
      explanation: "核心將 SI 的 dx、dt 轉成 Sc，之後沿用相同更新結構。",
      snippet: `config.scale = FDTD1D_SI;
config.dx = spatial_step_m;
config.dt = time_step_s;
config.courant = c0 * config.dt / config.dx;`,
    },
    experiment: {
      goal: "證明相同無因次設定在 normalized 與 SI 中產生相同演化。",
      setup: ["Source 選 Additive", "Normalized Sc=0.9", "記錄一個固定 step 的 probe 值"],
      steps: ["在 normalized 模式執行並記錄 probe。", "切到 SI，設 dx=1 mm。", "設 dt=0.9dx/c≈3.002 ps。", "重設並在相同 step 比較 probe。"],
      expected: ["兩個 case 的 Courant 都是 0.9。", "相同 step 的無因次場陣列應在浮點誤差內一致。"],
      successCriteria: ["能從 dx 自行算出 dt", "不把 index 173 誤寫成固定 173 m 或 173 mm"],
    },
    misconceptions: [
      { claim: "SI 模式比 normalized 更真實。", correction: "兩者只是尺度表示；模型內容與解析度才決定可信度。" },
      { claim: "真空波長足以決定所有材料的 Δx。", correction: "高折射率材料中的波長更短，通常才是限制條件。" },
    ],
    selfChecks: [
      { question: "εr 從 1 增加到 9，材料內波長如何變？", answer: "在 μr=1、頻率固定時縮短為 1/3。" },
      { question: "Normalized 與 SI 結果不同，先檢查哪些量？", answer: "Sc、source 的 step-domain 參數、材料相對參數、格點位置與 conductivity 單位。" },
    ],
  },

  observations: {
    prerequisites: ["能讀取單一 probe 時序", "理解固定尺度與自動尺度的差異"],
    concepts: [
      {
        title: "Snapshot、probe 與 waterfall 各回答一個問題",
        paragraphs: [
          "Snapshot 顯示某一 step 的空間分布；probe 固定位置記錄時間序列；waterfall 把多個 snapshot 疊成 x-t 圖。它們不能互相取代：單張圖看不出精確到達時間，單一 probe 也看不到波從哪裡反射。",
        ],
      },
      {
        title: "方向分解比位置猜測可靠",
        paragraphs: [
          "波包位於畫面右側不代表它向右。使用局部阻抗將場分成 E→ 與 E←，或在 waterfall 中觀察軌跡斜率，才能判斷方向。介面附近因 Yee 空間與時間交錯會有局部殘差，反射係數仍應在均勻區 probe 量測。",
        ],
      },
      {
        title: "定量量測必須固定視窗與尺度",
        paragraphs: [
          "Auto Y 會讓每幀最大值占據相似圖高，適合觀察小訊號，但會破壞跨時間振幅比較。比較反射、衰減或 instability 時應使用 Fixed Y，並在事先選定的時間窗取得 peak、RMS 或能量。",
          "目前 energy proxy 是教學指標，將 Ez² 與 (η0Hy)² 加總後平均；它不是帶有 ε、μ 與 cell volume 的完整 SI 能量。",
        ],
      },
    ],
    workedExample: {
      title: "從 waterfall 斜率估計速度",
      given: ["波峰在 step 100 位於 m=80", "step 140 位於 m=112"],
      steps: ["位移 Δm=112-80=32 cells。", "時間差 Δq=40 steps。", "數值速度為 32/40=0.8 cell/step。"],
      result: "在 normalized vacuum 中這個斜率對應 Sc≈0.8；反向斜率則表示左行回波。",
    },
    codeBridge: {
      title: "快照必須複製，不可保存可變指標",
      explanation: "Web Worker 每次傳送獨立 field buffer，避免歷史資料被下一步覆寫。",
      snippet: `snapshot.electric = field_copy(ez, grid_size);
history.push(snapshot.electric.slice());
if (history.length > history_limit)
    history.shift();`,
    },
    experiment: {
      goal: "用三種觀測方式確認同一個介面反射事件。",
      setup: ["TFSF、εr=4 dielectric", "Fixed Y=1", "先使用 directions view"],
      steps: ["在 snapshot 中辨識 E← 形成的位置。", "開啟 waterfall，確認該軌跡向左傾斜。", "記錄 probe 在反射抵達時的峰值。", "切 Auto Y，觀察視覺幅度如何改變但 probe 數值不變。"],
      expected: ["三種觀測指向相同反射時間與方向。", "Auto Y 改變畫面比例，不改變 WASM field value。"],
      successCriteria: ["能分別說出 snapshot、probe、waterfall 的證據", "振幅結論來自固定尺度或數值，不來自 Auto Y 圖高"],
    },
    misconceptions: [
      { claim: "波包在右邊就是右行波。", correction: "位置不含速度方向資訊；必須比較多個時間點或使用方向分解。" },
      { claim: "Energy proxy 不變就代表物理能量嚴格守恆。", correction: "目前 proxy 未含完整材料權重與單元體積，只適合趨勢與發散檢查。" },
    ],
    selfChecks: [
      { question: "為何介面上不適合直接讀 E→/E← 係數？", answer: "E/H 在 Yee grid 上不共點且材料跳變，局部分解含交錯與阻抗切換誤差；應在均勻區取 probe。" },
      { question: "Auto Y 最適合什麼工作？", answer: "尋找晚時間的小訊號與觀察形狀；不適合跨時間比較絕對振幅。" },
    ],
  },

  "modular-c": {
    prerequisites: ["能閱讀 bare-bones C 迴圈", "理解配置、狀態與輸出是不同責任"],
    concepts: [
      {
        title: "模組化不是把每行變成函式",
        paragraphs: [
          "有效模組應提供小而穩定的介面，並隱藏大量決策。呼叫端描述 domain、excitation、materials、terminations 與 observation；核心負責驗證、配置係數、更新順序與記憶體。",
        ],
      },
      {
        title: "Opaque state 保護不變條件",
        paragraphs: [
          "FDTD1D 結構只在 .c 內可見，外部不能任意改 phase、field pointer 或 coefficient。建立失敗時回傳清楚錯誤；成功後由 destroy 統一釋放。這比暴露十幾個 setter 更容易維持合法狀態。",
        ],
      },
      {
        title: "Native、CLI 與 WebAssembly 共用同一核心",
        paragraphs: [
          "Adapter 只負責把 JSON、命令列或 JavaScript 資料轉成同一份 ExperimentConfig。物理更新不能在前端重寫一份，否則 native test 通過也無法證明動畫使用相同方程。",
          "好的 seam 是 create/step/inspect/destroy。係數陣列、TFSF correction 與 matched profile 都留在 seam 後面。",
        ],
      },
    ],
    workedExample: {
      title: "誰應該計算 cezh？",
      given: ["UI 知道 εr=4", "核心知道 scale、dt、dx、σe", "cezh 依賴全部這些量"],
      steps: ["若 UI 計算 cezh，其他 adapter 必須複製公式。", "公式變更時多份實作可能分歧。", "讓 UI 只傳材料參數，由核心建立 cezh，可維持單一真相。"],
      result: "配置資料屬於公開介面；衍生係數屬於核心實作細節。",
    },
    codeBridge: {
      title: "小介面承載完整實驗",
      explanation: "呼叫端不接觸 coefficient 或 phase 內部狀態。",
      snippet: `struct FDTD1D *sim = fdtd1d_create_experiment(
    &config, error, sizeof(error));
while (fdtd1d_step(sim) == FDTD1D_OK)
    observe(fdtd1d_electric(sim));
fdtd1d_destroy(sim);`,
    },
    experiment: {
      goal: "從使用者操作追蹤資料如何跨越 adapter seam，而不重算物理。",
      setup: ["選一組 TFSF、dielectric、Mur1 設定", "開啟 modular code 頁籤"],
      steps: ["列出 UI 送入 worker 的原始配置。", "對照 WASM adapter 將配置傳入哪些 C 函式。", "確認 field snapshot 從 C 記憶體複製回 worker。", "確認 Canvas 只繪圖，沒有執行 FDTD update。"],
      expected: ["只有 C core 推進電磁場。", "UI display 選項不改變 solver field array。"],
      successCriteria: ["能畫出 UI→worker→WASM→C core 的資料流", "能指出公開配置與私有係數的邊界"],
    },
    misconceptions: [
      { claim: "函式越多就越模組化。", correction: "若函式只是轉送內部細節，介面反而變淺且難以維護。" },
      { claim: "為效能應在 JavaScript 再寫一份近似 solver。", correction: "這會產生兩套物理真相；現有 WebAssembly 已直接執行 C 核心。" },
    ],
    selfChecks: [
      { question: "為何 FDTD1D struct 應保持 opaque？", answer: "避免呼叫端破壞 phase、陣列生命週期與係數一致性，並允許內部重構。" },
      { question: "Adapter 的合理責任有哪些？", answer: "資料表示轉換、錯誤傳遞與記憶體搬運；不應複製更新方程。" },
    ],
  },
};
