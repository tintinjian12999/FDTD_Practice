# uFDTD

uFDTD 是一個以 C17 實作、以驗證為核心的一維 finite-difference
time-domain（FDTD）學習專案。它包含原生 Windows CLI、桌面 GUI、C
數值核心，以及把同一核心編譯成 WebAssembly 的互動教材網站。

本專案是 John B. Schneider《Understanding the Finite-Difference
Time-Domain Method》的獨立原創 companion。網站會標示章節對照，但不重製
教科書文字、圖片或完整程式列表。

## 目前實作範圍

- 一維 `Ez/Hy` Yee grid，完整步與四個教學 phase。
- Gaussian hard/additive point source。
- 向左或向右的一維 TFSF Gaussian excitation。
- 左右獨立的 PMC、first-order Mur 與 graded matched absorbing layer。
- 有序、不重疊的線性、各向同性、非色散材料層：`epsilon_r`、`mu_r`、
  `sigma_e`、`sigma_m`。
- Normalized 與 SI 尺度。
- Courant stability 驗證，以及受格數、步數與場強門檻保護的 `Sc > 1`
  教學模式。
- 解析/參考測試：TFSF leakage、Fresnel reflection、matched loss
  attenuation、absorbing-layer reflection、SI/normalized equivalence。
- React/TypeScript/MDX/KaTeX/Canvas 2D 網站；C 核心在 Web Worker 內以
  WebAssembly 執行。

本版不是完整 2D/3D FDTD 或完整多維 PML。DFT、harmonic/Ricker source、
dispersive material、2D/3D、parallel solver 與 near-to-far-field transform
仍在 roadmap。

## Windows 環境

需求：64-bit Windows、Miniconda，以及 PowerShell 5.1 或 PowerShell 7。

```powershell
.\scripts\bootstrap.ps1
conda activate ufdtd-c
```

環境名稱固定為 `ufdtd-c`，包含 GCC、CMake、Ninja、MS-MPI、Python 測試與
繪圖套件，以及 Emscripten 3.1.58。

## 建置與執行 C 程式

```powershell
cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```

執行教科書 Ch. 3 導向的 bare-bones 範例：

```powershell
.\build\debug\book_1d_bare_bones.exe
```

執行目前向後相容的 point-source CLI：

```powershell
.\build\debug\fdtd1d.exe `
  --source additive `
  --boundary mur1 `
  --scale normalized `
  --grid-size 200 `
  --time-steps 450 `
  --courant 0.9 `
  --source-index 50 `
  --probe-index 100 `
  --snapshot-interval 10 `
  --output-dir output\fdtd1d
```

CLI 會輸出 `run.json`、`probe.csv` 與 `snapshots.csv`。產生 probe plot、
final-field plot 與 GIF：

```powershell
python -m scripts.visualize_fdtd1d output\fdtd1d
```

桌面 GUI：

```powershell
python -m gui.fdtd1d_gui
```

若 PowerShell 尚未初始化 `conda activate`：

```powershell
& "$env:LOCALAPPDATA\miniconda3\Scripts\conda.exe" run `
  -n ufdtd-c --no-capture-output python -m gui.fdtd1d_gui
```

## 互動網站

Windows 可直接雙擊根目錄的 `start-web.cmd`。它會啟用 `ufdtd-c`、安裝缺少的
Node 套件、重新編譯 C/WASM，並在 Vite 就緒後開啟瀏覽器。不要直接雙擊
`web/index.html`；React、Web Worker 與 WebAssembly 必須由 HTTP server 載入。

也可以在終端手動啟動：

```powershell
conda activate ufdtd-c
Set-Location web
npm install
npm run build:wasm
npm run dev
```

production 驗證：

```powershell
Set-Location web
npm test
npm run build
```

網站包含 17 節原創學習路徑、即時 `Ez/Hy` 動畫、固定或自動縱軸、局部或
真空阻抗磁場正規化、`E→/E←` 方向分解、waterfall、完整步與分相
步進、source/material/termination 控制、能量與 probe 指標，以及只保存在
瀏覽器的進度。進度可以匯出或匯入 JSON；沒有帳號、伺服器資料庫或遙測。

推送到 `main` 後，`.github/workflows/pages.yml` 會用 Emscripten 建置 C/WASM、
執行網站測試並部署 GitHub Pages。Repository Settings → Pages 的 Source 需設為
**GitHub Actions**。

## 新增自己的 C 程式

把來源放在 `examples/`，並在 `CMakeLists.txt` 新增獨立 target：

```cmake
add_executable(my_fdtd examples/my_fdtd.c)
target_compile_features(my_fdtd PRIVATE c_std_17)
target_link_libraries(my_fdtd PRIVATE ufdtd_fdtd1d)
```

重新執行 configure/build 後：

```powershell
cmake --preset debug
cmake --build --preset debug --target my_fdtd
.\build\debug\my_fdtd.exe
```

若程式輸出相容的 CSV/JSON，可沿用 `scripts/visualize_fdtd1d.py`；若新增了
不同維度或資料格式，應同時新增專用 loader、驗證測試與視覺化 adapter。

## 全套驗證

```powershell
.\scripts\verify.ps1
```

也可分開執行 native 與 web 測試。物理功能在進入網站前必須先有解析解或
獨立 reference test；動畫不能取代數值驗收。

## 授權

- 原始碼：MIT，見 `LICENSE`。
- 原創教材與網站敘述：CC BY-SA 4.0，見 `CONTENT_LICENSE.md`。
- 教科書與第三方內容不因此被重新授權，見 `THIRD_PARTY_NOTICES.md`。
