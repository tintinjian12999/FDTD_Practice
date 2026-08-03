# uFDTD

## 中文

uFDTD 是以 John B. Schneider 的 *Understanding the Finite-Difference
Time-Domain Method* 為學習依據的原生 Windows C17 專案。目前包含書中
Program 3.1 的獨立重現、可重用的一維 Yee 網格求解核心、命令列介面、
資料驗證、靜態圖與 GIF 動畫。

### 建立環境

需求為 64-bit Windows 11、Miniconda，以及 Windows PowerShell 5.1 或
PowerShell 7。在儲存庫根目錄執行：

```powershell
.\scripts\bootstrap.ps1
conda activate ufdtd-c
```

專案只建立或更新隔離環境 `ufdtd-c`，不會修改 `base` 或 `cpp_env`。
Windows 平行運算使用 Microsoft MPI（MS-MPI）。

### 建置與執行第一支書本程式

```powershell
cmake --preset debug
cmake --build --preset debug
.\build\debug\book_1d_bare_bones.exe
```

程式固定使用 200 個網格、250 個時間步，並將每個時間步的 `Ez[50]`
輸出至終端。延遲高斯脈衝應在輸出索引 80 達到峰值 1。

### 執行可設定的一維求解器

正規化單位範例：

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

SI 單位範例：

```powershell
.\build\debug\fdtd1d.exe `
  --source additive `
  --boundary mur1 `
  --scale si `
  --grid-size 200 `
  --time-steps 450 `
  --dx 0.01 `
  --dt 3.002076856783368e-11 `
  --source-index 50 `
  --probe-index 100 `
  --snapshot-interval 10 `
  --output-dir output\fdtd1d-si
```

SI 模式由 \(S_c=c_0\Delta t/\Delta x\) 計算 Courant 數。兩種尺度都強制
\(0<S_c\le1\)；不合法或矛盾的參數會在建立輸出目錄前以結束碼 2 拒絕。

激發注入方式與邊界條件可獨立組合：

- `--source additive`：將高斯脈衝加到內部 `Ez`，返回波可穿過源位置。
- `--source hard`：直接覆寫內部 `Ez`；此源非透明，返回波會在源位置反射。
- `--boundary mur1`：兩端使用一階 Mur 吸收邊界。
- `--boundary pmc`：兩端使用 PMC 型反射邊界。

兩種 source 都必須位於 `2` 到 `grid_size - 3`。未指定時預設為
`additive` + `mur1`；輸出的 `run.json` 使用 schema version 2，並將
`source` 與 `boundary` 分開記錄。

完整參數可用 `.\build\debug\fdtd1d.exe --help` 查詢。每次執行會覆寫指定
目錄內的：

- `run.json`：解析後的設定、尺度與單位。
- `probe.csv`：`time_step,time,ez` 探針時間序列。
- `snapshots.csv`：`time_step,time,index,position,ez` 長格式場快照。

### 繪圖與動畫

```powershell
python -m scripts.visualize_fdtd1d output\fdtd1d
```

視覺化工具會先嚴格驗證 JSON/CSV 的結構、有限值、時間、索引與網格一致性，
再原子式產生 `probe.png`、`snapshot_final.png` 和 `field.gif`。無效資料不會
覆寫既有圖檔。

### Windows 桌面 GUI

必須先啟用完整的 Conda 環境，讓 Tk 與 Matplotlib 的原生 DLL 可被找到：

```powershell
conda activate ufdtd-c
python -m gui.fdtd1d_gui
```

若目前 PowerShell 尚未初始化 `conda activate`，可直接使用：

```powershell
& "$env:LOCALAPPDATA\miniconda3\Scripts\conda.exe" run `
  -n ufdtd-c --no-capture-output python -m gui.fdtd1d_gui
```

GUI 左側提供彼此獨立的 Source、Boundary、尺度、網格、探針與輸出目錄設定。
切換尺度會只啟用有效的 Courant 或 `dx`/`dt` 欄位；選擇 hard source 時會顯示
非透明源警告，但不會改寫 source index。
`Run / 執行` 會在背景呼叫同一支 C CLI，因此視窗保持可操作；`Cancel / 取消`
只會終止 GUI 自己啟動的求解器程序。

若輸出目錄已有已知的 FDTD 檔案，GUI 會在覆寫前要求確認。成功後右側顯示
探針時間序列與場快照，可用 Previous/Next、滑桿與 Play/Pause 檢視傳播。
失敗或無效的執行會保留上一份已驗證結果，詳細 stdout/stderr 顯示於執行紀錄。
GUI 優先使用 `build/release/fdtd1d.exe`，不存在時才使用 Debug 版本。

### 執行自己的 C 程式

將程式放在 `examples/`，並在 `CMakeLists.txt` 加入獨立 target，例如：

```cmake
add_executable(my_fdtd examples/my_fdtd.c)
target_compile_features(my_fdtd PRIVATE c_std_17)
target_link_libraries(my_fdtd PRIVATE ufdtd_fdtd1d)
```

重新執行 `cmake --preset debug` 與 `cmake --build --preset debug`，然後執行
`.\build\debug\my_fdtd.exe`。若只需要命令列參數，通常直接擴充或呼叫
`fdtd1d.exe` 較適合。

### 完整驗證與目前限制

```powershell
.\scripts\verify.ps1
```

驗證涵蓋 Debug/Release、警告視為錯誤、CTest、pthread、四程序 MS-MPI、
數值回歸、命令列輸出、嚴格資料驗證與圖像生成。

第一版只支援一維、均勻自由空間、Gaussian 激發、hard/additive 注入、單一
探針，以及 PMC 或一階 Mur 邊界；尚未包含介質、損耗、色散、TFSF、PML、
二維／三維或獨立安裝程式。

## English

uFDTD is a native Windows C17 learning project based on John B. Schneider's
*Understanding the Finite-Difference Time-Domain Method*. It includes an
independent reproduction of Program 3.1, a reusable one-dimensional Yee-grid
solver, a strict CLI, validated data output, static plots, and GIF animation.

### Environment and build

The prerequisites are 64-bit Windows 11, Miniconda, and Windows PowerShell 5.1
or PowerShell 7.

```powershell
.\scripts\bootstrap.ps1
conda activate ufdtd-c
cmake --preset debug
cmake --build --preset debug
```

The isolated `ufdtd-c` environment leaves `base` and `cpp_env` unchanged.
Native parallel checks use Microsoft MPI.

Run the book-faithful program:

```powershell
.\build\debug\book_1d_bare_bones.exe
```

Run the configurable normalized solver:

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

For SI units, replace `--courant 0.9` with, for example,
`--scale si --dx 0.01 --dt 3.002076856783368e-11`. The solver derives
\(S_c=c_0\Delta t/\Delta x\) and requires \(0<S_c\le1\).

Source injection and boundary behavior are independent. `--source additive`
adds the Gaussian pulse and lets returning waves cross the source location;
`--source hard` overwrites interior `Ez` and is non-transparent. Select either
`--boundary mur1` for first-order absorbing boundaries or `--boundary pmc` for
reflecting boundaries. Both source types require an index from 2 through
`grid_size - 3`. The defaults are additive and Mur1. Use
`.\build\debug\fdtd1d.exe --help` for every option.

Each run replaces `run.json`, `probe.csv`, and `snapshots.csv` in its output
directory. Generate validated plots and animation with:

```powershell
python -m scripts.visualize_fdtd1d output\fdtd1d
```

This creates `probe.png`, `snapshot_final.png`, and `field.gif` only after all
input files pass schema and numerical checks.

### Windows desktop GUI

Activate the complete Conda environment before launching so Tk and Matplotlib
can locate their native DLLs:

```powershell
conda activate ufdtd-c
python -m gui.fdtd1d_gui
```

If `conda activate` is not initialized in the current PowerShell session:

```powershell
& "$env:LOCALAPPDATA\miniconda3\Scripts\conda.exe" run `
  -n ufdtd-c --no-capture-output python -m gui.fdtd1d_gui
```

The left pane exposes independent source and boundary choices plus scale, grid,
probe, and output settings. Selecting a hard source displays a non-transparency
warning without changing the source index. Only the active normalized or SI
scale fields are enabled. Run launches the
same C CLI on a background worker, Cancel terminates only the process owned by
the GUI, and recognized output files require confirmation before replacement.

After a successful strict load, the right pane displays the probe history and
field snapshots with previous/next buttons, a slider, and play/pause. Failed or
invalid runs preserve the last valid display and append stdout/stderr to the
execution log. Release `fdtd1d.exe` is preferred, with Debug as fallback.

To build your own source, place it under `examples/`, add a distinct
`add_executable` target to `CMakeLists.txt`, link `ufdtd_fdtd1d` when the shared
core is needed, reconfigure, and build.

Run the full Debug, Release, CTest, MPI, Pytest, numerical, and visualization
workflow with:

```powershell
.\scripts\verify.ps1
```

The first solver version is limited to one-dimensional uniform free space, a
Gaussian hard or additive source, one probe, and PMC or first-order Mur
boundaries. Materials, loss, dispersion, TFSF, PML, two/three dimensions, and a
standalone installer are not yet included.
