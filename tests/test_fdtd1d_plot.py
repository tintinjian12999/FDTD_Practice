from pathlib import Path
import tkinter as tk

import numpy as np
import pytest

from gui.fdtd1d_plot import ResultPlot, prepare_frames
from scripts.visualize_fdtd1d import (
    BoundaryMetadata,
    ProbeData,
    RunMetadata,
    SnapshotData,
    SourceMetadata,
)


ROOT = Path(__file__).parents[1]


def sample_run() -> tuple[RunMetadata, ProbeData, SnapshotData]:
    metadata = RunMetadata(
        schema_version=2,
        scale="normalized",
        grid_size=5,
        time_steps=3,
        courant=1.0,
        dx=1.0,
        dt=1.0,
        probe_index=3,
        source=SourceMetadata(
            injection="additive",
            waveform="gaussian",
            index=2,
            delay_steps=1.0,
            width_steps=1.0,
            amplitude=1.0,
        ),
        boundary=BoundaryMetadata(type="mur1"),
        snapshot_interval=2,
        time_unit="normalized",
        position_unit="cells",
    )
    probe = ProbeData(
        np.array([0, 1, 2]),
        np.array([0.0, 1.0, 2.0]),
        np.array([0.0, 0.5, 0.2]),
    )
    steps = np.repeat(np.array([0, 2]), 5)
    indices = np.tile(np.arange(5), 2)
    snapshots = SnapshotData(
        steps,
        steps.astype(float),
        indices,
        indices.astype(float),
        np.arange(10, dtype=float) / 10.0,
    )
    return metadata, probe, snapshots


def test_prepare_frames_returns_read_only_grouped_arrays() -> None:
    metadata, _, snapshots = sample_run()

    frames = prepare_frames(metadata, snapshots)

    np.testing.assert_array_equal(frames.steps, [0, 2])
    assert frames.positions.shape == (2, 5)
    assert frames.electric.shape == (2, 5)
    np.testing.assert_allclose(frames.electric[1], np.arange(5, 10) / 10.0)
    assert not frames.steps.flags.writeable
    assert not frames.positions.flags.writeable
    assert not frames.electric.flags.writeable


def test_prepare_frames_rejects_empty_or_mismatched_rows() -> None:
    metadata, _, snapshots = sample_run()
    short = SnapshotData(
        snapshots.time_step[:-1],
        snapshots.time[:-1],
        snapshots.index[:-1],
        snapshots.position[:-1],
        snapshots.ez[:-1],
    )
    empty = SnapshotData(*(np.array([]) for _ in range(5)))

    with pytest.raises(ValueError):
        prepare_frames(metadata, short)
    with pytest.raises(ValueError):
        prepare_frames(metadata, empty)


def test_result_plot_navigates_and_controls_animation() -> None:
    metadata, probe, snapshots = sample_run()
    root = tk.Tk()
    root.withdraw()
    observed_frames: list[int] = []
    try:
        plot = ResultPlot(root, observed_frames.append)
        plot.show_run(metadata, probe, snapshots)
        assert plot.frame_count == 2
        assert plot.current_frame == 0
        assert observed_frames[-1] == 0

        plot.set_frame(999)
        assert plot.current_frame == 1
        assert observed_frames[-1] == 1
        plot.previous_frame()
        assert plot.current_frame == 0
        plot.next_frame()
        assert plot.current_frame == 1
        assert plot.start() is True
        plot.stop()

        one_frame = SnapshotData(
            snapshots.time_step[:5],
            snapshots.time[:5],
            snapshots.index[:5],
            snapshots.position[:5],
            snapshots.ez[:5],
        )
        plot.show_run(metadata, probe, one_frame)
        assert plot.start() is False
    finally:
        root.destroy()
