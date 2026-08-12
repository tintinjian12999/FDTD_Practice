import type { LessonDetail } from "./types";

export const sourceBoundaryDetails: Record<string, LessonDetail> = {
  "hard-source": {
    prerequisites: ["理解 source 在每個 time step 套用一次", "知道 total field 是入射與返回波的疊加"],
    concepts: [
      {
        title: "Hard 的意思是覆寫",
        paragraphs: [
          "Hard source 在 curl update 完成後直接指定 Ez[source]=g[q]。該節點原本由 Maxwell 更新得到的值會被丟棄，所以 source 對外送出的波形受到強制控制。",
          "這種做法像時間變動的 Dirichlet 條件。它適合重現最小教科書程式，也適合測試指定節點是否精確跟隨波形，但不是透明的物理天線模型。",
        ],
        equation: "E_z^{q+1}[m_s]\leftarrow g[q]",
      },
      {
        title: "返回波遇到 hard node 會被改寫",
        paragraphs: [
          "當邊界或材料產生的反射回到 source，curl update 原本會把返回波帶入該節點；下一個 excitation phase 卻再次覆寫它。source 因此成為額外散射中心，且晚時間結果會依 source 波形是否已衰減而改變。",
        ],
      },
      {
        title: "何時仍值得使用",
        paragraphs: [
          "若只觀察第一個傳播週期、返回波尚未抵達 source，hard source 可以提供非常清楚的入射幅度。也可以故意搭配 PMC，示範 source 不透明造成的二次反射。對散射係數或長時間 resonator，應改用 additive 或 TFSF。",
        ],
      },
    ],
    workedExample: {
      title: "返回波到 source 時發生什麼",
      given: ["curl update 後 source node 為 0.25", "該 step 的 Gaussian g[q]=0.01"],
      steps: ["Maxwell update 已把返回波貢獻算成 0.25。", "hard excitation 執行 Ez[source]=0.01。", "原本 0.24 的差值不再存在於計算域。"],
      result: "hard source 吸收或重新散射部分返回場，因此不能把晚時間差異歸咎於 termination。",
    },
    codeBridge: {
      title: "覆寫必須是獨立 phase",
      explanation: "把 hard source 放在明確位置，才能追蹤它覆蓋了哪一次自然更新。",
      snippet: `update_electric_interior(simulation);

double value = gaussian_source(simulation);
simulation->ez[source_index] = value;`,
    },
    experiment: {
      goal: "觀察 hard source 對返回波不透明的證據。",
      setup: ["左、右 termination 都選 PMC", "固定 Y 軸", "先使用 Hard source"],
      steps: ["重設並播放，等待右端回波向左返回。", "觀察回波穿過 source 前後的 E←。", "改成 Additive 並重複相同步數。", "比較 source 附近與第二次往返的差異。"],
      expected: ["Hard case 在 source 位置出現額外改變。", "Additive case 的返回波較連續地穿過 source。"],
      successCriteria: ["能指出差異首次出現的空間位置", "能把差異連結到 assignment 與 addition"],
    },
    misconceptions: [
      { claim: "Hard source 代表功率較大。", correction: "Hard 描述數值注入方式，不描述振幅或功率。" },
      { claim: "Hard source 能吸收返回波，所以可當 ABC。", correction: "它只在單一節點強制波形，會產生非物理散射，不能取代經驗證的 termination。" },
    ],
    selfChecks: [
      { question: "何時 hard 與 additive 的結果可能幾乎相同？", answer: "在第一個入射波通過且尚無反射返回 source 的時間窗內。" },
      { question: "若 g[q] 已為零，hard node 等效什麼條件？", answer: "它固定 Ez=0，近似一個 PEC 型電場節點。" },
    ],
  },

  "additive-source": {
    prerequisites: ["理解 hard source 的覆寫行為", "知道線性 Maxwell 方程允許場疊加"],
    concepts: [
      {
        title: "Soft source 保留既有場",
        paragraphs: [
          "Additive source 執行 Ez[source]+=g[q]，把指定激發疊加到 curl update 的結果。因此返回波仍保留在 total field 中，source node 不再是被強制固定的邊界。",
        ],
        equation: "E_z^{q+1}[m_s]\leftarrow E_z^{q+1}[m_s]+g[q]",
      },
      {
        title: "透明不等於無散射",
        paragraphs: [
          "Additive source 可視為局部驅動項，仍可能因離散注入方式與頻譜造成散射。它比 hard source 對返回場透明，但並沒有自動匹配任何實體天線或傳輸線。",
          "位於域內的單點 additive source 通常同時向左與向右輻射。若目標是單向已知入射場，需使用 TFSF。",
        ],
      },
      {
        title: "Source 與 termination 必須正交選擇",
        paragraphs: [
          "Source 回答能量如何進入域；termination 回答波到達域外端時如何處理。把 additive 與 Mur、PMC 或 matched 任意組合，才能分別研究注入與邊界效應。",
        ],
      },
    ],
    workedExample: {
      title: "比較 assignment 與 addition",
      given: ["更新後 Ez[source]=-0.30", "當前 g[q]=0.10"],
      steps: ["Hard source 將結果設為 +0.10。", "Additive source 將結果變成 -0.20。", "兩者差 0.30，正是被 hard source 丟棄的既有場。"],
      result: "當既有場接近零時兩者相似；返回波抵達後差異才顯著。",
    },
    codeBridge: {
      title: "一個運算子改變 source 物理",
      explanation: "程式差異很小，但邊界透明度完全不同。",
      snippet: `/* Hard injection. */
ez[source] = waveform;

/* Additive injection. */
ez[source] += waveform;`,
    },
    experiment: {
      goal: "確認 additive point source 是雙向且允許返回波通過。",
      setup: ["Source 選 Additive", "兩端選 Mur1", "Trace view 選 directions"],
      steps: ["重設並播放到 source 脈衝形成。", "同時觀察 E→ 與 E←。", "把右端改 PMC 並重設。", "等待右端返回波越過 source，確認仍可繼續向左。"],
      expected: ["初始激發同時產生左右行分量。", "PMC 回波不會在 source node 被完全截斷。"],
      successCriteria: ["能指出 additive 與 TFSF 的方向性差異", "能辨認 source 通過性而非只看第一個波包"],
    },
    misconceptions: [
      { claim: "Soft source 不會影響任何返回波。", correction: "它不覆寫返回波，但仍是離散局部驅動，不能視為完全不存在。" },
      { claim: "Additive source 只向設定方向發射。", correction: "單點注入沒有方向參數，通常向兩側輻射。" },
    ],
    selfChecks: [
      { question: "為何線性系統允許 additive injection？", answer: "Maxwell 線性方程允許把 source 引起的場與域內既有場相加。" },
      { question: "要量測單一介面反射，為何 TFSF 通常比 additive 更方便？", answer: "TFSF 可把 incident field 與 scattered field 分區，避免雙向 source 混入反射量測。" },
    ],
  },

  "pmc-reflection": {
    prerequisites: ["知道反射會改變波的傳播方向", "能使用 E→/E← 分辨方向"],
    concepts: [
      {
        title: "PMC 強制切向磁場為零",
        paragraphs: [
          "一維右端 PMC 要求總 Hy 在邊界消失。入射與反射磁場必須異號相消；由於反射方向改變本來就會翻轉 E/H 的方向關係，電場反射係數為 +1。",
        ],
        equation: "\Gamma_E^{PMC}=+1,\qquad \Gamma_H^{PMC}=-1",
      },
      {
        title: "它是理想校準器，不是吸收器",
        paragraphs: [
          "PMC 產生幅度已知、相位明確的完整反射，適合驗證往返時間、方向分解與左右 termination 是否獨立。看到回波不是失敗，而是刻意建立的 reference case。",
        ],
      },
      {
        title: "隱含 PMC 如何出現在 bare-bones 程式",
        paragraphs: [
          "若最後一個 Hy 節點從未更新並保持零，波到達端點時便看到 PMC。這說明每個陣列端點都必須有明確物理解釋；「沒有寫條件」本身就是一種條件。",
        ],
      },
    ],
    workedExample: {
      title: "預測 PMC 回波時間與符號",
      given: ["source index=50", "right boundary=239", "Sc=1", "source peak step=42"],
      steps: ["單程距離為 239-50=189 格。", "往返距離為 378 格，因此回到 source 約需 378 steps。", "PMC 的 Ez 反射係數 +1，所以同極性波峰返回。"],
      result: "source 附近約在 step 420 看見同號回波；實際峰值會受脈衝寬度與離散邊界位置影響。",
    },
    codeBridge: {
      title: "一維 PMC 的端點更新",
      explanation: "令端點 Ez 等於相鄰 Ez 可形成零法向差，對應此教學模型的 PMC。",
      snippet: `size_t last = grid_size - 1;
ez[last] = ez[last - 1];`,
    },
    experiment: {
      goal: "以完整反射建立 termination 的基準尺度。",
      setup: ["Source 選 Additive", "右端 PMC、左端 Mur1", "Trace view 選 directions", "固定 Y 軸"],
      steps: ["預先計算 source 到右端的往返 step。", "重設並播放至入射 E→ 接近右端。", "觀察 E← 從右端形成。", "在預測時間附近讀取 probe，並與 Mur1 case 比較。"],
      expected: ["反射 Ez 與入射 Ez 同極性。", "PMC 回波遠大於 Mur1 回波。"],
      successCriteria: ["回波時間符合距離/Sc 估算", "方向分解在反射前後由 E→ 轉為 E←"],
    },
    misconceptions: [
      { claim: "所有導體邊界都讓 Ez 同號反射。", correction: "PEC 與 PMC 的 E/H 反射相位不同；還要看場分量與邊界方向。" },
      { claim: "PMC 是常見金屬表面。", correction: "一般理想金屬是 PEC；PMC 多作理論或數值校準邊界。" },
    ],
    selfChecks: [
      { question: "PMC 反射後為何 Hy 反號？", answer: "邊界要求總 Hy=0，因此反射 Hy 必須抵消入射 Hy。" },
      { question: "把 source-boundary 距離加倍，回波延遲如何變？", answer: "單程和回程都加倍，所以往返延遲也加倍。" },
    ],
  },

  "absorbing-boundary": {
    prerequisites: ["理解波動方程可分解為左右行 advection equation", "知道邊界更新需要過去時間樣本"],
    concepts: [
      {
        title: "只允許向外行進的局部模型",
        paragraphs: [
          "一維波動算子可分解為向左與向右的一階 advection operator。右端 ABC 選擇只滿足向右行的關係，等效假設抵達邊界的波應繼續離開，而不允許未知的向左分量從域外進來。",
        ],
        equation: "\left(\frac{\partial}{\partial x}+\frac{1}{v}\frac{\partial}{\partial t}\right)E_z=0\quad\text{at the right boundary}",
      },
      {
        title: "Mur1 需要保存兩個時間層",
        paragraphs: [
          "新的邊界值由舊的內鄰居與新內鄰居共同外推，因此更新 interior 前必須先保存舊 boundary history。若先覆蓋舊值，公式仍能編譯，卻已不是 Mur1。",
        ],
        equation: "E_N^{q+1}=E_{N-1}^{q}+\frac{S_c-1}{S_c+1}\left(E_{N-1}^{q+1}-E_N^q\right)",
      },
      {
        title: "吸收品質取決於假設是否成立",
        paragraphs: [
          "在一維真空且 Sc=1 時，係數為零，邊界只需複製上一時間步的鄰居，對理想行波非常準確。Sc≠1、介質靠近 reference cells、數值色散或高維斜入射都會增加反射。",
          "因此核心要求 Mur reference cells 保持真空，避免默默使用錯誤的局部速度。更一般的域終止應使用 matched layer 或完整 PML。",
        ],
      },
    ],
    workedExample: {
      title: "計算 Sc=0.8 的 Mur 係數",
      given: ["Sc=0.8", "舊內鄰居=0.40", "新內鄰居=0.55", "舊邊界=0.35"],
      steps: ["係數 (0.8-1)/(0.8+1)=-1/9≈-0.1111。", "差值為 0.55-0.35=0.20。", "新邊界=0.40-0.1111×0.20≈0.3778。"],
      result: "新邊界不是單純複製新鄰居；它結合兩個時間層來近似向外 advection。",
    },
    codeBridge: {
      title: "先 capture，再更新 interior",
      explanation: "歷史值的擷取順序是 ABC 正確性的必要條件。",
      snippet: `double old_edge = ez[last];
double old_neighbor = ez[last - 1];
update_electric_interior(simulation);
ez[last] = old_neighbor + coefficient
         * (ez[last - 1] - old_edge);`,
    },
    experiment: {
      goal: "定量比較 PMC、Mur1 與 matched termination 的晚到回波。",
      setup: ["Source 選 Additive", "左端 Mur1", "右端依序 PMC、Mur1、Matched", "固定相同 source 與 Sc"],
      steps: ["先用 PMC 取得完整回波基準。", "換 Mur1，重設並在相同時間窗讀取 probe。", "換 Matched，再重複量測。", "以各 case 峰值除以 PMC 峰值得到相對回波。"],
      expected: ["PMC 約為完整反射。", "Sc=1 真空下 Mur1 回波接近數值零；matched 也顯著小於 PMC。"],
      successCriteria: ["所有 case 使用相同時間窗與固定 Y", "能用比值而非肉眼描述吸收品質"],
    },
    misconceptions: [
      { claim: "Mur1 把波的能量刪掉，所以不物理。", correction: "它近似開放域，使能量流出有限計算窗；目的不是模擬吸收材料。" },
      { claim: "Mur1 在任何材料與角度都無反射。", correction: "它源自局部單向波假設，離開設計條件後只是近似。" },
    ],
    selfChecks: [
      { question: "Sc=1 時 Mur 係數是多少？", answer: "零，因此新邊界等於舊的內鄰居。" },
      { question: "為何 Mur history 必須在 E interior update 前保存？", answer: "公式同時需要 q 與 q+1 時間層；更新後再保存會丟失 q 層資料。" },
    ],
  },
};
