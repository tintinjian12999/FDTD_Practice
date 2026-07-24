# uFDTD

## 繁體中文

uFDTD 是依據 John B. Schneider《Understanding the Finite-Difference
Time-Domain Method》建立的原生 Windows C 語言 FDTD 學習與開發專案。
目前已具備可重現的 C17 工具鏈、序列程式、pthread、四程序 MPI，以及
Python 圖形後處理驗證。

### 必要條件

- 64-bit Windows 11
- Miniconda；`conda.exe` 位於 `PATH`，或安裝在
  `%LOCALAPPDATA%\miniconda3`
- Windows PowerShell 5.1 或 PowerShell 7

本專案使用 Conda 建立獨立的 `ufdtd-c` 環境，不會將 FDTD 套件安裝到
`base` 或既有的 `cpp_env`。在原生 Windows 上，MPI 實作採用 Microsoft
MPI（MS-MPI），不是書中類 Unix 環境常見的 Open MPI。

### 建立或更新環境

在專案根目錄執行：

```powershell
.\scripts\bootstrap.ps1
```

腳本會依據 `environment.yml` 建立或更新 `ufdtd-c`，並驗證 GCC、CMake、
Ninja 與 Python。腳本也會在操作前後比對既有的 `base` 和 `cpp_env`
套件狀態。

若 PowerShell 執行原則阻擋本機腳本，可只對這一次程序使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

### 執行完整驗證

```powershell
.\scripts\verify.ps1
```

完整驗證包括：

- Debug 與 Release C17 編譯
- 數學、動態記憶體及 CSV 輸出測試
- 兩執行緒 pthread 測試
- 四個本機程序的 MS-MPI 測試
- Python CSV 驗證與無視窗 Matplotlib 繪圖測試

成功後會在 `output/smoke/` 產生 `signal.csv` 與 `signal.png`。

### 互動式 C 開發

```powershell
conda activate ufdtd-c
cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```

主要設定：

- 語言標準：C17
- 編譯器：GCC 15.2
- 警告：`-Wall -Wextra -Wpedantic`
- 建置系統：CMake 與 Ninja
- pthread 連結：`Threads::Threads`
- MPI 連結：`MPI::MPI_C`

新練習程式可依照 `examples/smoke/` 的小型範例建立，再於
`CMakeLists.txt` 新增獨立 target 與 CTest。

### 專案資料

- `environment.yml`：Conda 依賴與版本範圍
- `CMakeLists.txt`：C 程式、pthread、MPI 與測試定義
- `CMakePresets.json`：Debug 與 Release 設定
- `examples/smoke/`：工具鏈可執行驗證
- `scripts/`：環境、驗證及繪圖工具
- `tests/`：Python 自動測試
- `docs/superpowers/`：核准的設計與實作計畫

本機書籍 `ufdtd.pdf`、建置目錄與產生的資料已刻意列入 `.gitignore`，
不會提交到版本控制。

## English

uFDTD is a native Windows C learning and development project based on John B.
Schneider's *Understanding the Finite-Difference Time-Domain Method*. It
provides a reproducible C17 toolchain with serial, pthread, four-process MPI,
and Python post-processing checks.

### Prerequisites

- 64-bit Windows 11
- Miniconda with `conda.exe` in `PATH`, or installed under
  `%LOCALAPPDATA%\miniconda3`
- Windows PowerShell 5.1 or PowerShell 7

The project creates an isolated Conda environment named `ufdtd-c`; it does not
install FDTD dependencies into `base` or the existing `cpp_env`. Native Windows
uses Microsoft MPI (MS-MPI), rather than the Open MPI implementation commonly
used by the book's Unix-like examples.

### Create or update the environment

Run from the repository root:

```powershell
.\scripts\bootstrap.ps1
```

The script creates or updates `ufdtd-c` from `environment.yml`, verifies GCC,
CMake, Ninja, and Python, and compares the existing `base` and `cpp_env`
package states before and after the operation.

If the PowerShell execution policy blocks local scripts, bypass it for this
process only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

### Run complete verification

```powershell
.\scripts\verify.ps1
```

Verification covers:

- Debug and Release C17 builds
- Math, dynamic-memory, and CSV-output checks
- A two-worker pthread check
- A four-process local MS-MPI check
- Strict Python CSV validation and headless Matplotlib plotting

Successful verification creates `signal.csv` and `signal.png` under
`output/smoke/`.

### Interactive C development

```powershell
conda activate ufdtd-c
cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```

The canonical configuration uses C17, GCC 15.2,
`-Wall -Wextra -Wpedantic`, CMake, Ninja, `Threads::Threads`, and
`MPI::MPI_C`. Use the small programs under `examples/smoke/` as templates for
new exercises, then register each program as a separate target and CTest in
`CMakeLists.txt`.

### Repository contents

- `environment.yml`: Conda dependencies and version ranges
- `CMakeLists.txt`: C, pthread, MPI, and test definitions
- `CMakePresets.json`: Debug and Release configurations
- `examples/smoke/`: executable toolchain checks
- `scripts/`: environment, verification, and plotting tools
- `tests/`: Python automated tests
- `docs/superpowers/`: approved design and implementation plan

The local `ufdtd.pdf`, build trees, and generated outputs are intentionally
ignored and are not committed to version control.
