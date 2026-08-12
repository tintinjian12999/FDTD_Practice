import type { LessonDetail } from "./types";

export const foundationDetails: Record<string, LessonDetail> = {
  "numeric-evidence": {
    prerequisites: ["能讀懂科學記號，例如 1e-6", "知道電腦以有限位元儲存浮點數"],
    concepts: [
      {
        title: "先把三種誤差分開",
        paragraphs: [
          "Round-off error 來自有限精度；truncation error 來自用有限差分取代微分；model error 則來自我們刻意忽略的物理，例如色散、非線性或三維幾何。三者的改善方法不同，不能用提高 double 精度解決空間網格過粗。",
          "FDTD 即使使用無限精度運算，仍有離散誤差。反過來說，程式沒有 NaN、動畫平滑，也不能證明離散模型已逼近 Maxwell 方程的解。",
        ],
      },
      {
        title: "Verification 與 validation 回答不同問題",
        paragraphs: [
          "Verification 問的是「方程有沒有被正確寫成程式」；可以用解析波速、Fresnel 係數、能量界線與 regression test 檢查。Validation 問的是「這組方程是否足以代表真實裝置」；需要材料量測、幾何公差或實驗資料。",
          "本網站的自動測試主要屬於 verification。它能證明一維核心符合已指定的模型，不能把一維模型自動升格為真實三維系統。",
        ],
      },
      {
        title: "建立最小收斂實驗",
        paragraphs: [
          "先選一個可量測輸出，例如 probe 的到達時間或反射峰值；固定物理問題後縮小 Δx，並同步縮小 Δt 以維持相同 Courant number。若是二階離散且已進入漸近區，Δx 減半後主導誤差應約縮小四倍。",
        ],
        equation: String.raw`e(h)\approx C h^p,\qquad \frac{e(h)}{e(h/2)}\approx 2^p`,
        bullets: ["一次只改網格尺度", "比較可量化指標，不比較截圖感覺", "至少使用三個解析度確認趨勢"],
      },
    ],
    workedExample: {
      title: "由誤差比例估計收斂階數",
      given: ["粗網格誤差 e(h)=0.012", "半網格誤差 e(h/2)=0.0031"],
      steps: [
        "計算誤差比 0.012/0.0031≈3.87。",
        "使用 p=log2(3.87) 得到 p≈1.95。",
        "結果接近二階，但仍需第三個網格排除偶然抵消。",
      ],
      result: "觀察到約二階收斂，與中心差分的預期一致；這比「兩張曲線很像」更有證據力。",
    },
    codeBridge: {
      title: "不要用浮點數直接相等判斷",
      explanation: "數值測試應使用與問題尺度相稱的 absolute/relative tolerance。",
      snippet: `double scale = fmax(fabs(expected), fabs(actual));
double error = fabs(actual - expected);
bool close = error <= absolute_tol + relative_tol * scale;`,
    },
    experiment: {
      goal: "辨識 Courant 改變造成的到達時間與波形差異，而不是把任何差異都稱為錯誤。",
      setup: ["Source 選 Additive", "兩端選 Mur1", "Trace view 選 E→/E←", "Fixed Y 設為 1"],
      steps: [
        "以 Sc=0.9 重設並播放，記錄波峰到達 probe 的 step。",
        "改成 Sc=0.7，重設後記錄相同量。",
        "比較到達 step，而非只看播放所花的牆鐘時間。",
        "再改回 Sc=0.9，確認第一次結果可重現。",
      ],
      expected: ["Sc 較小時，每一步跨越的網格距離較少，因此到達所需 step 增加。", "固定 Y 下振幅差異不會被自動縮放掩蓋。"],
      successCriteria: ["能以 source-probe 距離估算到達 step", "重複 Sc=0.9 時量測值一致"],
    },
    misconceptions: [
      { claim: "程式成功執行就代表答案正確。", correction: "成功執行只排除部分軟體故障；仍需解析解、收斂性與守恆量驗證。" },
      { claim: "改用 double 就能消除 FDTD 誤差。", correction: "double 主要降低 round-off，不能消除有限 Δx、Δt 的截斷與色散誤差。" },
    ],
    selfChecks: [
      { question: "網格加密後結果不收斂，至少有哪些可能原因？", answer: "尚未進入漸近收斂區、Δt 沒有同步調整、幾何或材料離散方式改變，或程式存在系統性錯誤。" },
      { question: "Verification 通過是否代表模型符合實驗？", answer: "不代表。Verification 證明程式忠實求解指定模型；與實驗一致屬於 validation。" },
    ],
  },

  "maxwell-wave": {
    prerequisites: ["知道 E 與 H 是向量場", "知道偏導數描述場隨位置或時間的局部變化"],
    concepts: [
      {
        title: "從旋度方程挑出一維分量",
        paragraphs: [
          "假設所有場只隨 x 改變，電場只有 z 分量 Ez，磁場只有 y 分量 Hy。Faraday 與 Ampère-Maxwell 方程便縮成兩條互相耦合的一階式：Ez 的空間差推動 Hy，Hy 的空間差再推動 Ez。",
          "這不是把電磁波簡化成單一純量，而是選定一個在均勻介質中自洽的極化。只要初始與邊界不產生其他分量，這對 Ez/Hy 可以獨立演化。",
        ],
        equation: String.raw`\mu\frac{\partial H_y}{\partial t}=\frac{\partial E_z}{\partial x},\qquad \epsilon\frac{\partial E_z}{\partial t}=\frac{\partial H_y}{\partial x}`,
      },
      {
        title: "波速與阻抗是不同物理量",
        paragraphs: [
          "波速 v=1/√(με) 決定相位移動多快；波阻抗 η=√(μ/ε) 決定同一行波中 E 與 H 的振幅比例。提高 εr 會同時降低速度與阻抗，但兩個變化不能互相替代。",
          "本程式符號慣例下，向右行波滿足 Hy=-Ez/η，向左行波滿足 Hy=+Ez/η。這正是方向分解 E→=(E-ηH)/2 與 E←=(E+ηH)/2 的來源。",
        ],
        equation: String.raw`v=\frac{1}{\sqrt{\mu\epsilon}},\qquad \eta=\sqrt{\frac{\mu}{\epsilon}}`,
      },
      {
        title: "為何 E 與 H 能自行傳播",
        paragraphs: [
          "對第一條式再取時間微分，並用第二條消去 Hy，可以得到 Ez 的二階波動方程。局部場梯度使另一個場改變，新的場又在鄰近位置建立梯度，能量因此向前傳遞，而不是由 source 每一格逐點搬運。",
        ],
        equation: String.raw`\frac{\partial^2 E_z}{\partial x^2}-\mu\epsilon\frac{\partial^2 E_z}{\partial t^2}=0`,
      },
    ],
    workedExample: {
      title: "εr=4 介質中的速度與阻抗",
      given: ["μr=1", "εr=4", "真空速度 c、真空阻抗 η0"],
      steps: ["計算相對波速 v/c=1/√(4×1)=1/2。", "計算相對阻抗 η/η0=√(1/4)=1/2。", "若 Ez=0.6，純行波的 |η0Hy|=2×0.6=1.2。"],
      result: "介質中波峰每 step 移動較慢，而且以 η0 繪製 Hy 時橘線會是 Ez 的兩倍；這不是能量增益。",
    },
    codeBridge: {
      title: "用局部阻抗分離傳播方向",
      explanation: "方向分解必須使用材料位置上的 η，而不是永遠使用 η0。",
      snippet: `double eta = eta0 * sqrt(mu_r / epsilon_r);
double right_going = 0.5 * (ez - eta * hy);
double left_going = 0.5 * (ez + eta * hy);`,
    },
    experiment: {
      goal: "用場的符號與方向分解辨識右行、左行波。",
      setup: ["Source 選 Additive", "Trace view 選 E→/E←", "兩端選 PMC 以產生明顯回波"],
      steps: ["重設並播放至脈衝離開 source。", "確認向右部分主要出現在 E→。", "等待右端反射後觀察 E←。", "切回 Ez/Hy，比較回波前後 Hy 的符號。"],
      expected: ["右行脈衝集中於 E→，右端回波集中於 E←。", "同一 Ez 極性的波改變方向時，Hy 符號反轉。"],
      successCriteria: ["不依波包所在左右位置也能判斷方向", "能用 Poynting vector Ez×Hy 的方向解釋符號"],
    },
    misconceptions: [
      { claim: "E 與 H 曲線同號就一定是向右。", correction: "方向取決於座標與分量定義；在本程式中同號對應向左。" },
      { claim: "速度慢表示阻抗一定大。", correction: "速度依賴 με 的乘積，阻抗依賴 μ/ε 的比值，兩者可獨立調整。" },
    ],
    selfChecks: [
      { question: "若 εr 與 μr 同時乘以 4，速度與阻抗如何變？", answer: "速度變為 1/4，阻抗不變，因為 μ/ε 的比值維持不變。" },
      { question: "為什麼 η0Hy 在介質中不能直接與 Ez 比振幅？", answer: "行波關係使用局部 η；η0Hy 額外乘上 η0/η，會把阻抗差混入圖形比例。" },
    ],
  },

  "yee-grid": {
    prerequisites: ["能辨識陣列索引 m 與時間索引 q", "理解中心差分使用兩側樣本估計中點導數"],
    concepts: [
      {
        title: "空間上相差半格",
        paragraphs: [
          "Ez[m] 位在 x=mΔx；Hy[m] 的陣列索引雖是整數，物理位置卻是 x=(m+1/2)Δx。因此 Hy[m] 更新時自然使用 Ez[m+1]-Ez[m]，導數位置正好落在 Hy 的位置。",
          "若把兩個陣列畫在同一個 x 座標上，只是視覺化近似。材料介面與方向分解附近尤其要記得這個半格差。",
        ],
      },
      {
        title: "時間上相差半步",
        paragraphs: [
          "Ez 儲存在整數時間 qΔt，Hy 儲存在 (q+1/2)Δt。先用 Ez^q 算 Hy^(q+1/2)，再用新的 Hy 算 Ez^(q+1)，形成 leapfrog。兩個場彼此追趕，卻不需要解大型聯立方程。",
        ],
        equation: String.raw`E_z^q\rightarrow H_y^{q+1/2}\rightarrow E_z^{q+1}`,
      },
      {
        title: "端點為何不能套用 interior stencil",
        paragraphs: [
          "Hy[size-1] 缺少右側 Ez，Ez[0] 缺少左側 Hy。直接讓迴圈越界不只是 C 記憶體錯誤，也代表數學 stencil 要求了計算域外的未知值。邊界條件的工作，就是提供端點缺少的物理資訊。",
        ],
        bullets: ["H loop: m=0 到 size-2", "E interior loop: m=1 到 size-2", "端點 E 由 termination phase 更新"],
      },
    ],
    workedExample: {
      title: "定位一個 H 更新所需的樣本",
      given: ["Δx=1", "Ez[10]=0.2", "Ez[11]=0.5", "Hy[10] 位於 x=10.5"],
      steps: ["空間差為 Ez[11]-Ez[10]=0.3。", "這個差分估計的是 x=10.5 的 ∂Ez/∂x。", "因此它應更新 Hy[10]，而不是 Hy[11]。"],
      result: "陣列索引和物理位置不同；在紙上標半格位置能預防大部分 off-by-one 錯誤。",
    },
    codeBridge: {
      title: "兩個不同的 interior 範圍",
      explanation: "迴圈邊界直接反映每個 stencil 所需的鄰居。",
      snippet: `for (size_t m = 0; m + 1 < size; ++m)
    hy[m] += chye[m] * (ez[m + 1] - ez[m]);

for (size_t m = 1; m + 1 < size; ++m)
    ez[m] += cezh[m] * (hy[m] - hy[m - 1]);`,
    },
    experiment: {
      goal: "逐相觀察 leapfrog 更新，而不是把一個 time step 視為不可分割動作。",
      setup: ["暫停播放", "選 Additive source", "Fixed Y 設 1"],
      steps: ["按重設，確認兩個場皆為零。", "按一次分相，讀取狀態列的 Update E。", "再按一次，確認只有 interior Ez 更新。", "完成 excitation 與 termination 相位，觀察 step 才增加。"],
      expected: ["狀態依 H、E、excitation、termination 循環。", "完整步等價於連續執行四個 phase。"],
      successCriteria: ["能說明每個 phase 讀取哪一個已知場", "能指出 source 與 termination 不屬於 interior curl update"],
    },
    misconceptions: [
      { claim: "Ez[m] 和 Hy[m] 位於同一格點。", correction: "它們只共享陣列索引形式，物理位置相差 Δx/2。" },
      { claim: "先更新 E 或先更新 H 完全等價。", correction: "必須連同時間標記、source 與邊界的取樣時刻一起重新定義，不能只交換迴圈。" },
    ],
    selfChecks: [
      { question: "為什麼 H update 可以從 m=0 開始？", answer: "Hy[0] 需要 Ez[0] 與 Ez[1]，兩者都在陣列內。" },
      { question: "為什麼完整快照中的 E 與 H 並非完全同一時間？", answer: "Yee leapfrog 將 H 儲存在半時間步；顯示時把最近的 E、H 同時畫出。" },
    ],
  },

  "update-equations": {
    prerequisites: ["完成 Yee 網格一節", "能由斜率概念理解差分商"],
    concepts: [
      {
        title: "中心差分不是任意相減",
        paragraphs: [
          "在目標位置兩側各取半格樣本，相減後除以間距，可以消去 Taylor 展開中的偶次偏差，得到局部二階精度。FDTD 同時對時間與空間使用這個結構。",
        ],
        equation: String.raw`f'(x_0)\approx\frac{f(x_0+\Delta/2)-f(x_0-\Delta/2)}{\Delta}+O(\Delta^2)`,
      },
      {
        title: "從 Maxwell 式解出未來場",
        paragraphs: [
          "把時間導數換成新舊場之差，把空間導數換成相鄰場之差，再代數移項，就得到顯式 update equation。右側只包含已知量，因此每個格點可直接更新。",
        ],
        equation: String.raw`H_y^{q+1/2}[m]=H_y^{q-1/2}[m]+\frac{\Delta t}{\mu\Delta x}(E_z^q[m+1]-E_z^q[m])`,
      },
      {
        title: "係數承載尺度、材料與損耗",
        paragraphs: [
          "均勻真空時，更新係數是常數；加入 εr、μr、σe、σm 後，每個位置可能不同。把 ceze、cezh、chyh、chye 預先算好，時間迴圈就只保留場差與乘加，也避免每一步重複做除法。",
          "無損時 ceze=chyh=1；有耗時它們小於 1，代表舊場在更新中衰減。cezh 與 chye 則決定 curl 對新場的耦合強度。",
        ],
      },
    ],
    workedExample: {
      title: "Normalized vacuum 的 H 更新",
      given: ["Sc=0.8", "η0=376.73 Ω", "Ez[m+1]-Ez[m]=0.3 V/m", "Hy old=0"],
      steps: ["normalized magnetic coefficient chye=Sc/η0。", "計算 0.8×0.3/376.73≈6.37×10^-4。", "把結果加到舊 Hy。"],
      result: "Hy 約為 6.37×10^-4 A/m；乘回 η0 後是 0.24 V/m，便於和 Ez 共同比例比較。",
    },
    codeBridge: {
      title: "時間迴圈只做局部乘加",
      explanation: "材料與尺度已封裝在係數陣列，更新式能直接對照推導。",
      snippet: `hy[m] = chyh[m] * hy[m]
      + chye[m] * (ez[m + 1] - ez[m]);

ez[m] = ceze[m] * ez[m]
      + cezh[m] * (hy[m] - hy[m - 1]);`,
    },
    experiment: {
      goal: "確認 field update、source 與 boundary 是三種不同操作。",
      setup: ["Source 選 Hard", "兩端選 PMC", "使用分相按鈕"],
      steps: ["重設後逐相前進到 Update E。", "記錄 source node 在 Apply excitation 前的值。", "再前進一相，觀察 hard source 覆寫該節點。", "前進到 termination，觀察只有端點接受邊界規則。"],
      expected: ["curl update 先建立自然場值，source 隨後注入或覆寫。", "termination 不應重新計算整個 interior。"],
      successCriteria: ["能把四個 phase 對應到程式責任", "能解釋為何 source 與 boundary 不應塞進 interior loop"],
    },
    misconceptions: [
      { claim: "中心差分永遠是二階準確。", correction: "需要函數足夠平滑；材料跳變與邊界附近的整體誤差行為可能不同。" },
      { claim: "係數越大代表物理場一定越強。", correction: "係數描述耦合比例，實際更新還取決於鄰近場差與穩定條件。" },
    ],
    selfChecks: [
      { question: "加入 εr=4 後 cezh 大致如何改變？", answer: "在相同 Sc、無損條件下約變為真空的 1/4，因此 E 對 H curl 的反應較小。" },
      { question: "為什麼預先計算係數有助於驗證？", answer: "可把材料初始化與時間更新分開測試，並讓核心迴圈更直接對照離散方程。" },
    ],
  },

  "bare-bones": {
    prerequisites: ["完成一維更新方程", "熟悉 C 陣列、for loop 與 size_t"],
    concepts: [
      {
        title: "最小可運作程式的五個部分",
        paragraphs: [
          "一支 bare-bones FDTD 程式需要零初始化的 Ez/Hy 陣列、外層時間迴圈、H interior loop、E interior loop，以及一個明確的 source。缺少 termination 並不代表沒有邊界，而是陣列端點的未更新規則本身就形成邊界。",
        ],
        bullets: ["allocate and zero fields", "advance H", "advance E", "apply source and termination", "observe or write output"],
      },
      {
        title: "一個 probe 足以先驗證傳播時間",
        paragraphs: [
          "若 Sc=1、source 位於 0、probe 位於 50，Gaussian 峰值在 source step 30 出現，probe 峰值應約在 step 80。先驗證這種單一可預測量，比一開始就製作完整動畫更容易定位錯誤。",
        ],
        equation: String.raw`q_{arrival}\approx q_{source}+\frac{|m_{probe}-m_{source}|}{S_c}`,
      },
      {
        title: "教學版與工程版有不同責任",
        paragraphs: [
          "教學版把公式攤在 main() 裡，適合逐行追蹤。當來源、材料與邊界種類增加後，仍把所有條件塞進時間迴圈會快速失去可讀性。工程版應保留相同數值核心，但把配置驗證、係數建立與生命週期收進模組。",
        ],
      },
    ],
    workedExample: {
      title: "預測 probe 的 Gaussian 峰值時間",
      given: ["source index=20", "probe index=100", "source delay=42 steps", "Sc=0.8"],
      steps: ["格點距離為 |100-20|=80。", "每 step 傳播約 0.8 格，因此旅行時間約 80/0.8=100 steps。", "加上 source delay 得到峰值約在 step 142。"],
      result: "若量測相差很多，先檢查 source 位置、Sc、材料波速與 probe 定義，再懷疑繪圖。",
    },
    codeBridge: {
      title: "可逐行對照的核心迴圈",
      explanation: "先保持更新順序清楚，再逐步加入來源與邊界。",
      snippet: `for (size_t q = 0; q < max_time; ++q) {
    update_magnetic(hy, ez, size);
    update_electric(ez, hy, size);
    ez[source] += gaussian(q, delay, width);
    write_probe(q, ez[probe]);
}`,
    },
    experiment: {
      goal: "以可計算的旅行時間驗證第一支程式，而不是只確認有波形。",
      setup: ["Source 選 Additive", "Sc=0.9", "兩端 Mur1", "記下畫面顯示的 probe index"],
      steps: ["計算 source 到 probe 的格點距離。", "以距離/Sc 估算旅行 step。", "重設並完整步進，記錄 probe 最大值出現時間。", "比較估算與量測並解釋 Gaussian 寬度造成的不確定度。"],
      expected: ["量測峰值時間接近 delay+distance/Sc。", "若路徑包含介質，必須分段使用局部速度。"],
      successCriteria: ["能在執行前寫出到達時間預測", "預測與量測差異小於數個 source width"],
    },
    misconceptions: [
      { claim: "沒有寫 boundary code 就沒有邊界。", correction: "未更新的端點等同施加了隱含條件，通常會反射。" },
      { claim: "程式越短越接近物理。", correction: "短程式便於學習，但可能隱藏固定尺寸、單一材料與錯誤處理缺失。" },
    ],
    selfChecks: [
      { question: "為什麼初始場通常設為零？", answer: "代表模擬開始前域內無儲存電磁能，之後的場可追溯到指定 source。" },
      { question: "probe 峰值時間比預測晚一倍，最先檢查什麼？", answer: "檢查介質的相速度、Courant number 以及 source/probe 距離是否以格點而非公尺混用。" },
    ],
  },
};
