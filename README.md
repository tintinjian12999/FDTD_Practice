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
  --mode additive-abc `
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
  --mode additive-abc `
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

邊界／激發模式：

- `additive-abc`：網格內加性高斯源，兩端使用一階 Mur 吸收邊界。
- `hard-pmc`：重現書本早期範例，在索引 0 使用硬源；另一端為 PMC 型反射
  邊界。

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

第一版只支援一維、均勻自由空間、Gaussian 激發、單一探針，以及一階 Mur
ABC；尚未包含介質、損耗、色散、TFSF、PML、二維／三維或 GUI。

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
  --mode additive-abc `
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

`additive-abc` uses an interior additive Gaussian source and first-order Mur
boundaries. `hard-pmc` places a hard source at index 0 and retains the
reflecting boundary behavior of the early book example. Use
`.\build\debug\fdtd1d.exe --help` for every option.

Each run replaces `run.json`, `probe.csv`, and `snapshots.csv` in its output
directory. Generate validated plots and animation with:

```powershell
python -m scripts.visualize_fdtd1d output\fdtd1d
```

This creates `probe.png`, `snapshot_final.png`, and `field.gif` only after all
input files pass schema and numerical checks.

To build your own source, place it under `examples/`, add a distinct
`add_executable` target to `CMakeLists.txt`, link `ufdtd_fdtd1d` when the shared
core is needed, reconfigure, and build.

Run the full Debug, Release, CTest, MPI, Pytest, numerical, and visualization
workflow with:

```powershell
.\scripts\verify.ps1
```

The first solver version is limited to one-dimensional uniform free space, a
Gaussian source, one probe, and first-order Mur ABC. Materials, loss,
dispersion, TFSF, PML, two/three dimensions, and a GUI are not yet included.
