from pathlib import Path
import os
import subprocess
import sys
import tkinter as tk

from gui.fdtd1d_gui import check_environment


ROOT = Path(__file__).parents[1]


def run_child(code: str, timeout: int = 15) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-X", "faulthandler", "-c", code],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env={
            name: value
            for name, value in os.environ.items()
            if not name.startswith("PYTEST")
        },
        timeout=timeout,
        check=False,
    )


def test_import_does_not_create_default_root() -> None:
    assert tk._default_root is None


def test_environment_check_and_cli_modes() -> None:
    check_environment(ROOT)
    valid = subprocess.run(
        [sys.executable, "-m", "gui.fdtd1d_gui", "--check"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    invalid = subprocess.run(
        [sys.executable, "-m", "gui.fdtd1d_gui", "--unknown"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert valid.returncode == 0
    assert "FDTD GUI environment check passed." in valid.stdout
    assert invalid.returncode == 2


def test_visible_result_plot_exits_cleanly() -> None:
    code = (
        "import tkinter as tk; "
        "from gui.fdtd1d_plot import ResultPlot; "
        "root=tk.Tk(); plot=ResultPlot(root); "
        "plot.widget.pack(fill='both', expand=True); "
        "root.after(1500, root.destroy); root.mainloop()"
    )
    result = run_child(code)

    assert result.returncode == 0, result.stderr


def test_application_constructs_and_switches_scale_and_mode() -> None:
    code = (
        "import tkinter as tk; "
        "from gui.fdtd1d_gui import FDTD1DApplication, ROOT; "
        "root=tk.Tk(); root.withdraw(); app=FDTD1DApplication(root, ROOT); "
        "app.variables['scale'].set('si'); "
        "app.variables['mode'].set('hard-pmc'); root.update(); "
        "assert str(app.entries['courant'].cget('state')) == 'disabled'; "
        "assert str(app.entries['dx'].cget('state')) == 'normal'; "
        "assert app.variables['source_index'].get() == '0'; "
        "app._playing=True; app.play_button.configure(text='Pause'); "
        "app._reset_playback(); assert not app._playing; "
        "assert str(app.play_button.cget('text')) == 'Play / 播放'; "
        "root.destroy()"
    )
    result = run_child(code)

    assert result.returncode == 0, result.stderr


def test_application_guards_startup_close_and_worker_errors() -> None:
    code = (
        "import tkinter as tk; from pathlib import Path; "
        "from gui.fdtd1d_gui import FDTD1DApplication, ROOT, messagebox; "
        "root=tk.Tk(); root.withdraw(); app=FDTD1DApplication(root, ROOT); "
        "app._set_running(True); app.cancel_simulation(); "
        "assert app._cancel_event.is_set(); "
        "asked=[]; destroyed=[]; "
        "messagebox.askyesno=lambda *a,**k: asked.append(True) and False; "
        "app._destroy=lambda: destroyed.append(True); app._request_close(); "
        "assert asked and not destroyed; "
        "app._set_status('failure', error=True); "
        "assert str(app.status_label.cget('style')) == 'Error.Status.TLabel'; "
        "app.runner=type('Failing',(),{'run':lambda *a,**k: "
        "(_ for _ in ()).throw(RuntimeError('boom'))})(); "
        "app._run_worker([],Path('.')); event=app.events.get_nowait(); "
        "assert event.error == 'boom'; root.destroy()"
    )
    result = run_child(code)

    assert result.returncode == 0, result.stderr


def test_application_runs_real_solver_without_blocking(
    tmp_path: Path,
) -> None:
    output = repr(str(tmp_path / "gui-run"))
    code = (
        "import time, tkinter as tk; "
        "from gui.fdtd1d_gui import FDTD1DApplication, ROOT; "
        "root=tk.Tk(); root.withdraw(); app=FDTD1DApplication(root, ROOT); "
        "values={'grid_size':'20','time_steps':'8','source_index':'5',"
        f"'probe_index':'10','snapshot_interval':'2','output_directory':{output}"
        "}; [app.variables[k].set(v) for k,v in values.items()]; "
        "app.run_simulation(); deadline=time.monotonic()+10; "
        "exec(\"while app.plot.frame_count == 0 and time.monotonic() < deadline:"
        "\\n root.update(); time.sleep(0.01)\"); "
        "assert app.plot.frame_count > 0; "
        "assert 'Completed' in app.status_text.get(); "
        "assert not app.runner.running; root.destroy()"
    )
    result = run_child(code, timeout=20)

    assert result.returncode == 0, result.stderr
