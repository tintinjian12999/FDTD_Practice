from __future__ import annotations

from dataclasses import dataclass, fields
from pathlib import Path
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

from gui.fdtd1d_model import (
    SimulationParameters,
    build_command,
    default_parameters,
    find_solver,
    recognized_outputs,
)
from gui.fdtd1d_plot import ResultPlot
from gui.fdtd1d_runner import RunResult, SimulationRunner
from scripts.visualize_fdtd1d import load_run


ROOT = Path(__file__).parents[1]


@dataclass(frozen=True)
class WorkerEvent:
    output_directory: Path
    result: RunResult | None = None
    error: str | None = None


class FDTD1DApplication:
    def __init__(
        self,
        root: tk.Tk,
        repository_root: Path = ROOT,
    ) -> None:
        self.root = root
        self.repository_root = repository_root
        self.runner = SimulationRunner()
        self.events: queue.Queue[WorkerEvent] = queue.Queue()
        self.variables = self._create_variables()
        self.entries: dict[str, ttk.Entry] = {}
        self.input_entries: list[ttk.Entry] = []
        self.input_combos: list[ttk.Combobox] = []
        self.result_widgets: list[ttk.Widget] = []
        self._running = False
        self._playing = False
        self._cancel_event = threading.Event()
        self._syncing_slider = False
        self._poll_identifier: str | None = None
        self.status_text = tk.StringVar(value="Ready / 就緒")
        self.frame_text = tk.StringVar(value="Frame 0 / 0")
        self._configure_window()
        self._configure_style()
        self._build_layout()
        self._connect_events()
        self._poll_results()

    def _create_variables(self) -> dict[str, tk.StringVar]:
        defaults = default_parameters(self.repository_root)
        return {
            item.name: tk.StringVar(value=getattr(defaults, item.name))
            for item in fields(SimulationParameters)
        }

    def _configure_window(self) -> None:
        self.root.title("uFDTD 1D Simulation Laboratory")
        self.root.geometry("1280x820")
        self.root.minsize(1040, 700)
        self.root.protocol("WM_DELETE_WINDOW", self._request_close)

    def _configure_style(self) -> None:
        style = ttk.Style(self.root)
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Section.TLabelframe.Label", font=("Segoe UI", 10, "bold"))
        style.configure("Run.TButton", font=("Segoe UI", 10, "bold"))
        style.configure("Status.TLabel", foreground="#174f78")
        style.configure("Error.Status.TLabel", foreground="#a51d1d")

    def _build_layout(self) -> None:
        main = ttk.Panedwindow(self.root, orient=tk.HORIZONTAL)
        main.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        controls = ttk.Frame(main, width=350, padding=(4, 2))
        results = ttk.Frame(main, padding=(10, 2, 2, 2))
        main.add(controls, weight=0)
        main.add(results, weight=1)
        ttk.Label(
            controls, text="1D FDTD Controls / 一維模擬控制",
            style="Title.TLabel",
        ).pack(anchor=tk.W, pady=(0, 10))
        self._build_simulation_group(controls)
        self._build_source_group(controls)
        self._build_scale_group(controls)
        self._build_output_group(controls)
        self._build_action_row(controls)
        self._build_result_area(results)

    def _add_entry(
        self,
        parent: ttk.LabelFrame,
        row: int,
        label: str,
        name: str,
        width: int = 14,
    ) -> ttk.Entry:
        ttk.Label(parent, text=label).grid(
            row=row, column=0, sticky=tk.W, padx=6, pady=3
        )
        entry = ttk.Entry(
            parent, textvariable=self.variables[name], width=width
        )
        entry.grid(row=row, column=1, sticky=tk.EW, padx=6, pady=3)
        parent.columnconfigure(1, weight=1)
        self.entries[name] = entry
        self.input_entries.append(entry)
        return entry

    def _build_simulation_group(self, parent: ttk.Frame) -> None:
        group = ttk.LabelFrame(
            parent, text="Simulation / 模擬", style="Section.TLabelframe"
        )
        group.pack(fill=tk.X, pady=4)
        ttk.Label(group, text="Mode / 模式").grid(
            row=0, column=0, sticky=tk.W, padx=6, pady=3
        )
        mode = ttk.Combobox(
            group, textvariable=self.variables["mode"],
            values=("additive-abc", "hard-pmc"), state="readonly", width=17,
        )
        mode.grid(row=0, column=1, sticky=tk.EW, padx=6, pady=3)
        ttk.Label(group, text="Scale / 尺度").grid(
            row=1, column=0, sticky=tk.W, padx=6, pady=3
        )
        scale = ttk.Combobox(
            group, textvariable=self.variables["scale"],
            values=("normalized", "si"), state="readonly", width=17,
        )
        scale.grid(row=1, column=1, sticky=tk.EW, padx=6, pady=3)
        self.input_combos.extend((mode, scale))
        self._add_entry(group, 2, "Grid size / 網格數", "grid_size")
        self._add_entry(group, 3, "Time steps / 時間步", "time_steps")

    def _build_source_group(self, parent: ttk.Frame) -> None:
        group = ttk.LabelFrame(
            parent, text="Source & Sampling / 激發與取樣",
            style="Section.TLabelframe",
        )
        group.pack(fill=tk.X, pady=4)
        rows = (
            ("Source index / 源位置", "source_index"),
            ("Probe index / 探針位置", "probe_index"),
            ("Delay / 延遲", "source_delay"),
            ("Width / 寬度", "source_width"),
            ("Amplitude / 振幅", "source_amplitude"),
            ("Snapshot interval / 快照間隔", "snapshot_interval"),
        )
        for row, (label, name) in enumerate(rows):
            self._add_entry(group, row, label, name)

    def _build_scale_group(self, parent: ttk.Frame) -> None:
        group = ttk.LabelFrame(
            parent, text="Scale Values / 尺度參數",
            style="Section.TLabelframe",
        )
        group.pack(fill=tk.X, pady=4)
        self._add_entry(group, 0, "Courant number", "courant")
        self._add_entry(group, 1, "dx (m)", "dx")
        self._add_entry(group, 2, "dt (s)", "dt")

    def _build_output_group(self, parent: ttk.Frame) -> None:
        group = ttk.LabelFrame(
            parent, text="Output / 輸出", style="Section.TLabelframe"
        )
        group.pack(fill=tk.X, pady=4)
        entry = self._add_entry(
            group, 0, "Directory / 目錄", "output_directory", width=25
        )
        entry.grid(row=1, column=0, columnspan=2, sticky=tk.EW, padx=6, pady=3)
        self.browse_button = ttk.Button(
            group, text="Browse / 瀏覽", command=self._browse_output
        )
        self.browse_button.grid(
            row=2, column=0, columnspan=2, sticky=tk.EW, padx=6, pady=(2, 6)
        )

    def _build_action_row(self, parent: ttk.Frame) -> None:
        actions = ttk.Frame(parent)
        actions.pack(fill=tk.X, pady=(10, 4))
        self.run_button = ttk.Button(
            actions, text="Run / 執行", command=self.run_simulation,
            style="Run.TButton",
        )
        self.run_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))
        self.cancel_button = ttk.Button(
            actions, text="Cancel / 取消", command=self.cancel_simulation,
            state=tk.DISABLED,
        )
        self.cancel_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(4, 0))
        self.progress = ttk.Progressbar(parent, mode="indeterminate")
        self.progress.pack(fill=tk.X, pady=4)
        self.status_label = ttk.Label(
            parent, textvariable=self.status_text, style="Status.TLabel",
            wraplength=320,
        )
        self.status_label.pack(fill=tk.X, pady=(2, 0))

    def _build_snapshot_controls(self, parent: ttk.Frame) -> None:
        controls = ttk.Frame(parent)
        controls.pack(fill=tk.X, pady=(6, 4))
        previous = ttk.Button(
            controls, text="◀ Previous", command=self._previous_frame
        )
        previous.pack(side=tk.LEFT, padx=(0, 4))
        self.play_button = ttk.Button(
            controls, text="Play / 播放", command=self._toggle_play
        )
        self.play_button.pack(side=tk.LEFT, padx=4)
        next_button = ttk.Button(
            controls, text="Next ▶", command=self._next_frame
        )
        next_button.pack(side=tk.LEFT, padx=4)
        self.frame_slider = ttk.Scale(
            controls, from_=0, to=0, command=self._slider_changed
        )
        self.frame_slider.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=10)
        ttk.Label(controls, textvariable=self.frame_text).pack(side=tk.RIGHT)
        self.result_widgets.extend(
            (previous, self.play_button, next_button, self.frame_slider)
        )
        for widget in self.result_widgets:
            widget.configure(state=tk.DISABLED)

    def _build_result_area(self, parent: ttk.Frame) -> None:
        ttk.Label(
            parent, text="Validated Results / 驗證後結果",
            style="Title.TLabel",
        ).pack(anchor=tk.W, pady=(0, 4))
        self.plot = ResultPlot(parent, self._plot_frame_changed)
        self.plot.widget.pack(fill=tk.BOTH, expand=True)
        self._build_snapshot_controls(parent)
        ttk.Label(parent, text="Execution Log / 執行紀錄").pack(anchor=tk.W)
        self.log = scrolledtext.ScrolledText(
            parent, height=7, wrap=tk.WORD, state=tk.DISABLED,
            font=("Consolas", 9),
        )
        self.log.pack(fill=tk.X, pady=(3, 0))

    def _connect_events(self) -> None:
        self.variables["scale"].trace_add("write", self._scale_changed)
        self.variables["mode"].trace_add("write", self._mode_changed)
        self._update_scale_states()

    def _scale_changed(self, *_arguments: object) -> None:
        self._update_scale_states()

    def _mode_changed(self, *_arguments: object) -> None:
        if self.variables["mode"].get() == "hard-pmc":
            self.variables["source_index"].set("0")

    def _update_scale_states(self) -> None:
        if self._running:
            return
        normalized = self.variables["scale"].get() == "normalized"
        self.entries["courant"].configure(
            state=tk.NORMAL if normalized else tk.DISABLED
        )
        state = tk.DISABLED if normalized else tk.NORMAL
        self.entries["dx"].configure(state=state)
        self.entries["dt"].configure(state=state)

    def _browse_output(self) -> None:
        selected = filedialog.askdirectory(
            parent=self.root,
            initialdir=self.variables["output_directory"].get(),
            title="Select FDTD output directory",
        )
        if selected:
            self.variables["output_directory"].set(selected)

    def _parameters(self) -> SimulationParameters:
        return SimulationParameters(
            **{name: variable.get() for name, variable in self.variables.items()}
        )

    def _set_running(self, running: bool) -> None:
        self._running = running
        entry_state = tk.DISABLED if running else tk.NORMAL
        combo_state = tk.DISABLED if running else "readonly"
        for entry in self.input_entries:
            entry.configure(state=entry_state)
        for combo in self.input_combos:
            combo.configure(state=combo_state)
        self.browse_button.configure(state=entry_state)
        self.run_button.configure(state=entry_state)
        self.cancel_button.configure(
            state=tk.NORMAL if running else tk.DISABLED
        )
        if running:
            self.progress.start(12)
        else:
            self.progress.stop()
            self._update_scale_states()

    def _append_log(self, message: str) -> None:
        if not message:
            return
        self.log.configure(state=tk.NORMAL)
        self.log.insert(tk.END, message.rstrip() + "\n")
        self.log.see(tk.END)
        self.log.configure(state=tk.DISABLED)

    def _set_status(self, message: str, error: bool = False) -> None:
        style = "Error.Status.TLabel" if error else "Status.TLabel"
        self.status_text.set(message)
        self.status_label.configure(style=style)

    def _show_error(self, message: str) -> None:
        self._set_status(f"Error / 錯誤: {message}", error=True)
        self._append_log(f"ERROR: {message}")
        messagebox.showerror("uFDTD", message, parent=self.root)

    def run_simulation(self) -> None:
        if self._running:
            return
        try:
            parameters = self._parameters()
            executable = find_solver(self.repository_root)
            command = build_command(executable, parameters)
            output = Path(parameters.output_directory)
        except (ValueError, OSError) as error:
            self._show_error(str(error))
            return
        existing = recognized_outputs(output)
        if existing and not messagebox.askyesno(
            "Replace FDTD output?",
            f"{len(existing)} recognized files will be replaced.\nContinue?",
            parent=self.root,
        ):
            return
        self._reset_playback()
        self._cancel_event.clear()
        self._set_running(True)
        self._set_status("Running / 執行中")
        self._append_log(f"> {subprocess.list2cmdline(command)}")
        threading.Thread(
            target=self._run_worker,
            args=(command, output),
            daemon=True,
        ).start()

    def _run_worker(self, command: list[str], output: Path) -> None:
        try:
            result = self.runner.run(
                command,
                cwd=self.repository_root,
                cancel_event=self._cancel_event,
            )
            event = WorkerEvent(output, result=result)
        except Exception as error:
            event = WorkerEvent(output, error=str(error))
        self.events.put(event)

    def _poll_results(self) -> None:
        try:
            while True:
                self._handle_event(self.events.get_nowait())
        except queue.Empty:
            pass
        self._poll_identifier = self.root.after(50, self._poll_results)

    def _handle_success(self, output: Path) -> None:
        try:
            metadata, probe, snapshots = load_run(output)
            self.plot.show_run(metadata, probe, snapshots)
        except (ValueError, OSError) as error:
            self._show_error(f"Output validation failed: {error}")
            return
        maximum = max(self.plot.frame_count - 1, 0)
        self.frame_slider.configure(from_=0, to=maximum)
        for widget in self.result_widgets:
            widget.configure(state=tk.NORMAL)
        if self.plot.frame_count < 2:
            self.play_button.configure(state=tk.DISABLED)
        self._set_status("Completed / 完成")
        self._append_log(f"Loaded validated results from {output}")

    def _handle_event(self, event: WorkerEvent) -> None:
        self._set_running(False)
        if event.error is not None:
            self._show_error(event.error)
            return
        result = event.result
        if result is None:
            self._show_error("worker returned no result")
            return
        self._append_log(result.stdout)
        self._append_log(result.stderr)
        if result.cancelled:
            self._set_status("Cancelled / 已取消")
            self._append_log("Simulation cancelled.")
        elif result.returncode != 0:
            self._show_error(f"Solver exited with code {result.returncode}.")
        else:
            self._handle_success(event.output_directory)

    def cancel_simulation(self) -> None:
        if self._running:
            self._cancel_event.set()
            self.runner.cancel()
            self._set_status("Cancelling / 正在取消")
            self._append_log("Cancellation requested.")

    def _plot_frame_changed(self, frame: int) -> None:
        self._syncing_slider = True
        self.frame_slider.set(frame)
        self._syncing_slider = False
        self.frame_text.set(f"Frame {frame + 1} / {self.plot.frame_count}")

    def _slider_changed(self, value: str) -> None:
        if not self._syncing_slider:
            self.plot.set_frame(round(float(value)))

    def _previous_frame(self) -> None:
        self.plot.previous_frame()

    def _next_frame(self) -> None:
        self.plot.next_frame()

    def _toggle_play(self) -> None:
        if self._playing:
            self._reset_playback()
        else:
            if self.plot.start():
                self._playing = True
                self.play_button.configure(text="Pause / 暫停")

    def _reset_playback(self) -> None:
        self.plot.stop()
        self._playing = False
        self.play_button.configure(text="Play / 播放")

    def _request_close(self) -> None:
        if self._running and not messagebox.askyesno(
            "Exit uFDTD?",
            "A simulation is running. Cancel it and exit?",
            parent=self.root,
        ):
            return
        if self._running:
            self.cancel_simulation()
            self.root.after(50, self._wait_for_close)
        else:
            self._destroy()

    def _wait_for_close(self) -> None:
        if self._running:
            self.root.after(50, self._wait_for_close)
        else:
            self._destroy()

    def _destroy(self) -> None:
        self.plot.stop()
        if self._poll_identifier is not None:
            self.root.after_cancel(self._poll_identifier)
            self._poll_identifier = None
        self.root.destroy()


def check_environment(root: Path = ROOT) -> None:
    if tk.TkVersion < 8.6:
        raise RuntimeError("Tk 8.6 or newer is required")
    executable = find_solver(root)
    build_command(executable, default_parameters(root))


def main(arguments: list[str] | None = None) -> int:
    values = sys.argv[1:] if arguments is None else arguments
    if values == ["--check"]:
        try:
            check_environment()
        except (OSError, RuntimeError, ValueError) as error:
            print(f"FDTD GUI environment check failed: {error}", file=sys.stderr)
            return 1
        print("FDTD GUI environment check passed.")
        return 0
    if values:
        print("Usage: python -m gui.fdtd1d_gui [--check]", file=sys.stderr)
        return 2
    root = tk.Tk()
    FDTD1DApplication(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
