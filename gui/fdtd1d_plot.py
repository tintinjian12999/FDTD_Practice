from __future__ import annotations

from dataclasses import dataclass
import tkinter as tk

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import numpy as np

from scripts.visualize_fdtd1d import ProbeData, RunMetadata, SnapshotData


@dataclass(frozen=True)
class SnapshotFrames:
    steps: np.ndarray
    positions: np.ndarray
    electric: np.ndarray


def _read_only(values: np.ndarray) -> np.ndarray:
    result = np.array(values, copy=True)
    result.setflags(write=False)
    return result


def prepare_frames(
    metadata: RunMetadata,
    snapshots: SnapshotData,
) -> SnapshotFrames:
    row_count = snapshots.time_step.size
    columns = (
        snapshots.time,
        snapshots.index,
        snapshots.position,
        snapshots.ez,
    )
    if row_count == 0 or any(column.size != row_count for column in columns):
        raise ValueError("snapshot arrays are empty or have different lengths")
    if row_count % metadata.grid_size != 0:
        raise ValueError("snapshot rows do not form complete grid groups")
    group_count = row_count // metadata.grid_size
    grouped_steps = snapshots.time_step.reshape(group_count, metadata.grid_size)
    if not np.all(grouped_steps == grouped_steps[:, :1]):
        raise ValueError("snapshot groups contain mixed time steps")
    return SnapshotFrames(
        _read_only(grouped_steps[:, 0]),
        _read_only(
            snapshots.position.reshape(group_count, metadata.grid_size)
        ),
        _read_only(snapshots.ez.reshape(group_count, metadata.grid_size)),
    )


class ResultPlot:
    def __init__(self, parent: tk.Misc) -> None:
        self._parent = parent
        self.figure = Figure(figsize=(8.5, 6.2), dpi=100)
        self.probe_axis = self.figure.add_subplot(211)
        self.field_axis = self.figure.add_subplot(212)
        self.figure.subplots_adjust(
            left=0.10, right=0.97, top=0.93, bottom=0.10, hspace=0.42
        )
        self.canvas = FigureCanvasTkAgg(self.figure, master=parent)
        self._frames: SnapshotFrames | None = None
        self._field_line = None
        self._current_frame = 0
        self._after_identifier: str | None = None

    @property
    def widget(self) -> tk.Widget:
        return self.canvas.get_tk_widget()

    @property
    def frame_count(self) -> int:
        return 0 if self._frames is None else self._frames.steps.size

    @property
    def current_frame(self) -> int:
        return self._current_frame

    def _draw_probe(
        self,
        metadata: RunMetadata,
        probe: ProbeData,
    ) -> None:
        self.probe_axis.clear()
        self.probe_axis.plot(probe.time, probe.ez, color="#006699", linewidth=1.4)
        self.probe_axis.set_title(
            f"Probe Ez at grid index {metadata.probe_index}"
        )
        self.probe_axis.set_xlabel(f"Time ({metadata.time_unit})")
        self.probe_axis.set_ylabel("Ez")
        self.probe_axis.grid(True, alpha=0.25)

    def _initialize_field(
        self,
        metadata: RunMetadata,
        frames: SnapshotFrames,
    ) -> None:
        self.field_axis.clear()
        self._field_line, = self.field_axis.plot(
            frames.positions[0], frames.electric[0],
            color="#b43c2c", linewidth=1.4,
        )
        maximum = float(np.max(np.abs(frames.electric)))
        span = maximum * 1.1 if maximum > 0 else 1.0
        self.field_axis.set_ylim(-span, span)
        self.field_axis.set_xlabel(f"Position ({metadata.position_unit})")
        self.field_axis.set_ylabel("Ez")
        self.field_axis.grid(True, alpha=0.25)

    def show_run(
        self,
        metadata: RunMetadata,
        probe: ProbeData,
        snapshots: SnapshotData,
    ) -> None:
        self.stop()
        frames = prepare_frames(metadata, snapshots)
        self._frames = frames
        self._current_frame = 0
        self._draw_probe(metadata, probe)
        self._initialize_field(metadata, frames)
        self.set_frame(0)

    def set_frame(self, frame: int) -> None:
        if self._frames is None or self._field_line is None:
            return
        bounded = min(max(int(frame), 0), self.frame_count - 1)
        self._current_frame = bounded
        self._field_line.set_data(
            self._frames.positions[bounded],
            self._frames.electric[bounded],
        )
        step = int(self._frames.steps[bounded])
        self.field_axis.set_title(f"Electric field at time step {step}")
        self.canvas.draw_idle()

    def next_frame(self) -> None:
        self.set_frame(self._current_frame + 1)

    def previous_frame(self) -> None:
        self.set_frame(self._current_frame - 1)

    def _advance(self) -> None:
        self._after_identifier = None
        if self.frame_count == 0:
            return
        self.set_frame((self._current_frame + 1) % self.frame_count)
        self.start()

    def start(self) -> None:
        if self.frame_count > 1 and self._after_identifier is None:
            self._after_identifier = self._parent.after(100, self._advance)

    def stop(self) -> None:
        if self._after_identifier is not None:
            self._parent.after_cancel(self._after_identifier)
            self._after_identifier = None
