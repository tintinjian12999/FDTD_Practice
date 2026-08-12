import type { LessonDetail } from "./types";

export const advancedDetails: Record<string, LessonDetail> = {
  tfsf: {
    prerequisites: ["理解 additive source 會雙向輻射", "熟悉 Yee grid 的 E/H 半格與半步交錯"],
    concepts: [
      {
        title: "TFSF 先把計算域分成兩種場",
        paragraphs: [
          "Total-field region 儲存 incident+scattered field，scattered-field region 只儲存 scattered field。Seam 不是外部 termination，而是域內的一條會計邊界；所有 scatterer 必須放在 total-field 一側。",
          "若域內是真空且注入完美，scattered side 應接近零。加入材料後，穿回 seam 的反射波則會出現在 scattered side，因而可直接量測散射。",
        ],
      },
      {
        title: "為什麼只需要修正兩個節點",
        paragraphs: [
          "大多數 update stencil 的兩個鄰居都屬於同一區，只有跨越 seam 的一個 H stencil 與一個 E stencil 混用了 total/scattered field。對缺少的 incident contribution 加回或扣除，就能維持兩側定義一致。",
        ],
        equation: String.raw`H[s-1]\mathrel{-}=C_{H,E}E_{inc},\qquad E[s]\mathrel{+}=C_{E,H}H_{inc}`,
      },
      {
        title: "本版為何固定 Sc=1",
        paragraphs: [
          "目前 incident Gaussian 直接用解析延遲 q-m/Sc 取樣。當 Sc=1 時，一維真空 Yee grid 的數值波速與解析波精確匹配，半格修正可把 leakage 壓到浮點誤差。",
          "Sc≠1 時主網格有數值 dispersion，解析 incident field 卻沒有；只解除 UI 鎖定會在 seam 製造假散射。要支援任意穩定 Sc，需建立使用相同 Δx、Δt 的 auxiliary 1D incident grid。",
        ],
        equation: String.raw`E_{inc}[m,q]=\exp\left[-\left(\frac{q-m/S_c-d}{w}\right)^2\right]`,
      },
    ],
    workedExample: {
      title: "判斷哪個節點需要 incident correction",
      given: ["seam 在 Ez[50]", "左側是 scattered field", "右側是 total field"],
      steps: ["Hy[49] 的 stencil 使用 Ez[49] 與 Ez[50]，跨越 seam。", "Ez[50] 的 stencil使用 Hy[49] 與 Hy[50]，也跨越 seam。", "其他相鄰 pair 都在同一 field region，不需修正。"],
      result: "一維單一 seam 只修正 Hy[49] 與 Ez[50]；修正所有 total-field 節點反而會重複注入。",
    },
    codeBridge: {
      title: "Seam correction 與 source injection 分離",
      explanation: "核心在 H phase 與 excitation phase 分別套用正確時間／空間取樣的 incident field。",
      snippet: `hy[seam - 1] -= chye[seam - 1] * incident_e;

double incident_h = -incident_e_half / eta0;
ez[seam] += cezh[seam] * incident_h;`,
    },
    experiment: {
      goal: "先驗證空域 leakage，再加入 scatterer 量測真正反射。",
      setup: ["Source 選 TFSF right", "Sc 自動固定 1", "兩端 Mur1", "Trace view 選 directions"],
      steps: ["使用 Vacuum，重設並觀察 seam 左側。", "確認 incident E→ 只存在 total-field side。", "加入 εr=4 dielectric 並重設。", "觀察材料反射 E← 穿過 seam 進入 scattered side。"],
      expected: ["Vacuum scattered side 近乎零。", "加入介質後才出現具正確延遲與振幅的 scattered wave。"],
      successCriteria: ["能區分 seam leakage 與物理散射", "能說明為何 TFSF 時 Courant 控制被鎖定"],
    },
    misconceptions: [
      { claim: "TFSF 是吸收邊界。", correction: "它是 incident-field 注入與 total/scattered 分區；計算域外端仍需 termination。" },
      { claim: "把 Courant 輸入框解除 disabled 就能支援 Sc=0.8。", correction: "解析 incident field 會和具數值色散的主網格不匹配，造成 seam leakage。" },
    ],
    selfChecks: [
      { question: "為何 scatterer 必須在 total-field region？", answer: "scatterer 需要同時受到 incident 與 scattered field；其反射再穿過 seam 進入 scattered region。" },
      { question: "支援 Sc≠1 的正確方向是什麼？", answer: "使用與主網格相同離散方程的 auxiliary incident grid，而非繼續使用無色散解析波。" },
    ],
  },

  materials: {
    prerequisites: ["能分別計算波速與波阻抗", "理解 TFSF total/scattered field 分區"],
    concepts: [
      {
        title: "材料同時改變速度與場比例",
        paragraphs: [
          "線性、各向同性、非色散材料由 εr、μr 描述。折射率 n=√(εrμr) 決定相速度，η/η0=√(μr/εr) 決定 E/H 比。只有阻抗發生跳變時才產生法向入射反射；速度改變本身不是完整判據。",
        ],
        equation: String.raw`v=\frac{c}{\sqrt{\epsilon_r\mu_r}},\qquad \eta=\eta_0\sqrt{\frac{\mu_r}{\epsilon_r}}`,
      },
      {
        title: "單一介面的 Fresnel 係數",
        paragraphs: [
          "電場反射係數 Γ=(η2-η1)/(η2+η1)，負號表示 Ez 極性翻轉；傳輸係數 T=2η2/(η1+η2)=1+Γ。係數是場振幅比，不是功率比；功率還要考慮兩側阻抗。",
        ],
        equation: String.raw`\Gamma_E=\frac{\eta_2-\eta_1}{\eta_2+\eta_1},\qquad T_E=\frac{2\eta_2}{\eta_1+\eta_2}`,
      },
      {
        title: "有限厚 slab 有兩個介面與多重回波",
        paragraphs: [
          "Preset 的介質有起點與終點，因此不是單一半無限介面。第一界面先產生 -1/3 反射與 2/3 透射；到達介質-真空後又產生 +1/3 的內部反射，並有 4/3 的電場傳輸係數。第一次穿過整層的 Ez 因此是 (2/3)(4/3)=8/9。",
          "介質內返回波的 Ez 是 (2/3)(1/3)=2/9。若畫 η0Hy，因 η=η0/2，橘線會是 Ez 的兩倍；必須切到 η(x)Hy 或 E→/E← 才不會把阻抗比例誤認為增益。",
        ],
        equation: String.raw`E_{first\ pass}=T_{12}T_{23}=\frac{8}{9},\qquad E_{internal\ reflection}=T_{12}\Gamma_{23}=\frac{2}{9}`,
      },
    ],
    workedExample: {
      title: "完整追蹤 εr=4 slab 的第一輪波包",
      given: ["η1=η0", "η2=η0/2", "入射 Ez=1"],
      steps: ["前界面：Γ12=-1/3、T12=2/3。", "後界面：Γ23=+1/3、T23=4/3。", "介質內左行 Ez=(2/3)(1/3)=2/9；外部右行 Ez=(2/3)(4/3)=8/9。"],
      result: "動畫中介質內向左的 0.222 波包與右側真空中的 0.889 波包都符合解析解，並非數值增益。",
    },
    codeBridge: {
      title: "材料初始化成每格係數",
      explanation: "時間迴圈不判斷 material type，而是讀取已解析的 coefficient arrays。",
      snippet: `cezh[m] = courant * eta0 / epsilon_r[m];
chye[m] = courant / (eta0 * mu_r[m]);
ceze[m] = 1.0;
chyh[m] = 1.0;`,
    },
    experiment: {
      goal: "把前界面反射、後界面內反射與整層透射分開量測。",
      setup: ["TFSF right、Sc=1", "εr=4 dielectric", "Fixed Y=1", "Trace view 選 E→/E←"],
      steps: ["在介質左側均勻真空區量測第一個 E← 峰值。", "在介質內觀察後界面形成的 E←。", "在介質右側量測第一個 E→ 峰值。", "分別與 1/3、2/9、8/9 比較。"],
      expected: ["前界面反射約 0.333，極性相反。", "介質內後界面反射約 0.222；首次整層透射約 0.889。"],
      successCriteria: ["量測位置避開介面數格，降低 Yee staggering 影響", "不使用 Auto Y 的圖高當作振幅"],
    },
    misconceptions: [
      { claim: "介質只有一個反射波。", correction: "有限 slab 有兩個介面並會產生多次往返回波。" },
      { claim: "傳輸係數大於 1 一定違反能量守恆。", correction: "場振幅係數可大於 1；功率需包含阻抗，且要把反射功率一併計算。" },
    ],
    selfChecks: [
      { question: "若 εr=μr=4，介面是否反射？", answer: "η2/η1=√(4/4)=1，因此理想法向入射不反射；但速度降為 c/4。" },
      { question: "為何介質內 η0Hy 約為 Ez 的兩倍？", answer: "局部 η=η0/2，而行波滿足 |H|=|E|/η，所以 η0|H|=2|E|。" },
    ],
  },

  "loss-pml": {
    prerequisites: ["理解 impedance mismatch 造成反射", "知道 conductivity 會耗散場能量"],
    concepts: [
      {
        title: "有耗不等於匹配",
        paragraphs: [
          "只加入 σe 會形成複數 permittivity，通常同時改變 attenuation 與 impedance，因此波進入損耗區之前就先反射。好的 absorbing layer 必須在入口保持阻抗連續，再沿厚度逐步增加衰減。",
        ],
      },
      {
        title: "匹配電損耗與磁損耗",
        paragraphs: [
          "若 σe/ε=σm/μ，複數 ε 與 μ 具有相同損耗比例，阻抗比可保持不變，同時 propagation constant 取得正 attenuation。這是本 1D matched layer 的核心。",
        ],
        equation: String.raw`\frac{\sigma_e}{\epsilon}=\frac{\sigma_m}{\mu}`,
      },
      {
        title: "漸變 profile 降低離散入口反射",
        paragraphs: [
          "即使連續理論阻抗匹配，離散網格上突然跳到強損耗仍可能反射。使用 σ(x)=σmax(x/d)^m 從零平滑增加，可降低第一格的離散不連續；厚度、grading order 與 target reflection 共同決定 profile。",
          "這個一維 matched lossy layer 是理解 PML 的基礎，但不是完整 2D/3D PML。高維還要處理切向與法向分量、斜入射，以及 split-field、UPML 或 CPML 形式。",
        ],
        equation: String.raw`\sigma(x)=\sigma_{max}\left(\frac{x}{d}\right)^m`,
      },
    ],
    workedExample: {
      title: "判斷一組 normalized loss 是否匹配",
      given: ["εr=4", "μr=1", "σe=0.08", "σm=0.02"],
      steps: ["計算 σe/εr=0.08/4=0.02。", "計算 σm/μr=0.02/1=0.02。", "兩個 normalized loss ratio 相等，因此阻抗匹配。"],
      result: "若錯把 σm 也設為 0.08，衰減可能更強，但入口會因 loss tangent 不匹配而反射。",
    },
    codeBridge: {
      title: "損耗係數使用 trapezoidal 形式",
      explanation: "舊場衰減與 curl coupling 同時除以 1+loss，避免直接 Euler loss 帶來較差穩定性。",
      snippet: `double loss = sigma * dt / (2.0 * material);
decay[m] = (1.0 - loss) / (1.0 + loss);
curl[m] = base_curl / (1.0 + loss);`,
    },
    experiment: {
      goal: "分辨吸收層中的衰減與入口反射。",
      setup: ["Source 選 Additive", "右端先選 PMC 作基準", "Fixed Y=1", "使用 waterfall"],
      steps: ["用 PMC 記錄完整回波。", "右端改 Matched，重設並觀察波進入橘色層。", "確認場沿層厚逐步降低，而非入口突然消失。", "在相同晚時間窗量測返回 probe 的峰值比。"],
      expected: ["Matched layer 內軌跡逐漸變暗。", "返回峰值遠低於 PMC，但離散實作不會數學上完全為零。"],
      successCriteria: ["能分別指出入口 reflection 與 layer attenuation", "用 PMC-normalized 回波量化吸收品質"],
    },
    misconceptions: [
      { claim: "σ 越大，absorbing boundary 一定越好。", correction: "過強且突變的損耗會增加離散入口反射；厚度與 grading 同樣重要。" },
      { claim: "目前 1D matched layer 就是完整 CPML。", correction: "它展示匹配損耗原理，但不含高維 anisotropy、coordinate stretching 或 convolutional memory。" },
    ],
    selfChecks: [
      { question: "為何損耗 profile 從零開始？", answer: "讓 lossless interior 到 absorbing layer 的離散轉換較平滑，降低入口反射。" },
      { question: "target reflection 是實測保證值嗎？", answer: "不是；它用於連續近似下反推 σmax，實際反射仍受離散、厚度、頻譜與終端影響。" },
    ],
  },

  sandbox: {
    prerequisites: ["完成前面至少 source、boundary、Courant 與 material 四節", "能在執行前寫出可量化預測"],
    concepts: [
      {
        title: "把模擬寫成可否證的實驗",
        paragraphs: [
          "先寫 hypothesis、controlled variables、changed variable 與 measurement window，再操作 GUI。若先看動畫才決定要解釋什麼，很容易把每個現象合理化而無法發現錯誤。",
        ],
      },
      {
        title: "一次只改一個物理因素",
        paragraphs: [
          "同時改 source、Sc、material 與 termination，即使結果不同也無法歸因。建立 vacuum reference，複製配置後只改一項，並使用相同 Fixed Y、probe 位置與時間窗。",
          "顯示設定如 Auto Y、η0Hy 或 directions 不應改變 solver；它們可以改變判讀，所以也要記錄。",
        ],
      },
      {
        title: "從量測回到自動測試",
        paragraphs: [
          "若一個現象具有穩定解析預期，就把它轉成 native C test：例如 TFSF leakage<1e-9、εr=4 Fresnel reflection≈1/3、matched layer 回波顯著小於 PMC。自動測試讓未來重構不能悄悄破壞已建立的物理證據。",
        ],
      },
    ],
    workedExample: {
      title: "設計 εr=4 slab 驗收表",
      given: ["TFSF right, Sc=1", "slab εr=4、μr=1", "兩端 Mur1"],
      steps: ["預測前界面 |Γ|=1/3、內部反射 2/9、首次透射 8/9。", "選定三個均勻區 measurement windows。", "執行 vacuum reference 與 dielectric case，分離 incident field。"],
      result: "只有當三個係數與旅行時間同時符合，才能說明畫面中的波包身分，而非只靠移動方向猜測。",
    },
    codeBridge: {
      title: "把物理預期寫成 acceptance test",
      explanation: "測試名稱應描述可觀察行為，容差來自獨立解析值。",
      snippet: `double expected = 1.0 / 3.0;
double measured = measure_reflection(config);
CHECK(fabs(measured - expected) < 0.02);
CHECK(measure_tfsf_leakage(vacuum) < 1.0e-9);`,
    },
    experiment: {
      goal: "完成一份可重現、可被另一個人否證的 FDTD 實驗紀錄。",
      setup: ["選擇一個 source 問題與一個 boundary/material 問題", "固定顯示尺度與 probe"],
      steps: ["執行前寫下公式、預測符號、振幅與到達 step。", "先跑 vacuum 或 PMC reference。", "只修改一項變數並重新執行。", "保存配置、數值、時間窗與結論，記錄任何偏離。"],
      expected: ["結論可由另一位使用者用相同配置重現。", "若結果不符，能指出是哪一個 prediction 失敗，而非只說動畫怪異。"],
      successCriteria: ["至少包含一個解析量與一個對照組", "記錄 solver 參數和 display 參數，並區分兩者"],
    },
    misconceptions: [
      { claim: "參數掃得越多，研究越完整。", correction: "沒有對照與事先指標的大量掃描只會產生更多難以歸因的圖。" },
      { claim: "單一測試通過即可證明整個 solver。", correction: "每個測試只約束一部分行為；需要 source、boundary、material、scale 與安全性等互補證據。" },
    ],
    selfChecks: [
      { question: "為何要保存 display 設定？", answer: "Auto scale 與磁場正規化雖不改 solver，卻會改變人對振幅和方向的判讀。" },
      { question: "一個好的 failure report 至少包含什麼？", answer: "完整配置、重現步驟、預期值、實測值、量測位置與時間窗，以及是否可重現。" },
    ],
  },
};
