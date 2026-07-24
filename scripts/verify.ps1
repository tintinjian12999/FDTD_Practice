$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Get-CondaExecutable {
    $command = Get-Command conda.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $fallback = Join-Path $env:LOCALAPPDATA 'miniconda3\Scripts\conda.exe'
    if (Test-Path -LiteralPath $fallback) {
        return $fallback
    }
    throw 'Conda was not found in PATH or the standard Miniconda location.'
}

function Invoke-InEnvironment {
    param(
        [string]$Conda,
        [string[]]$Arguments
    )

    & $Conda run -n ufdtd-c --no-capture-output @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Environment command failed: $($Arguments -join ' ')"
    }
}

$conda = Get-CondaExecutable
$repositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repositoryRoot
try {
    New-Item -ItemType Directory -Force -Path 'output\smoke' | Out-Null
    foreach ($artifact in @(
        'output\smoke\signal.csv',
        'output\smoke\signal.png'
    )) {
        if (Test-Path -LiteralPath $artifact) {
            Remove-Item -LiteralPath $artifact -Force
        }
    }

    foreach ($preset in @('debug', 'release')) {
        $configureArguments = @(
            'cmake', '--preset', $preset, '--fresh'
        )
        if ($preset -eq 'debug') {
            $configureArguments += '-DUFDTD_WARNINGS_AS_ERRORS=ON'
        }
        Invoke-InEnvironment -Conda $conda -Arguments $configureArguments
        Invoke-InEnvironment -Conda $conda -Arguments @(
            'cmake', '--build', '--preset', $preset
        )
        if (Test-Path -LiteralPath 'output\smoke\signal.csv') {
            Remove-Item -LiteralPath 'output\smoke\signal.csv' -Force
        }
        Invoke-InEnvironment -Conda $conda -Arguments @(
            'ctest', '--preset', $preset
        )
        Invoke-InEnvironment -Conda $conda -Arguments @(
            'python', '-m',
            'scripts.validate_smoke_signal',
            'output/smoke/signal.csv'
        )
    }

    Invoke-InEnvironment -Conda $conda -Arguments @(
        'python', '-m', 'pytest', '-q'
    )
    Invoke-InEnvironment -Conda $conda -Arguments @(
        'python', '-m', 'gui.fdtd1d_gui', '--check'
    )
    Invoke-InEnvironment -Conda $conda -Arguments @(
        'python',
        'scripts/plot_signal.py',
        'output/smoke/signal.csv',
        'output/smoke/signal.png'
    )

    $plot = Get-Item -LiteralPath 'output\smoke\signal.png'
    if ($plot.Length -le 0) {
        throw 'Generated signal plot is empty.'
    }

    New-Item -ItemType Directory -Force -Path 'output\fdtd1d' | Out-Null
    $fdtdArtifacts = @(
        'run.json',
        'probe.csv',
        'snapshots.csv',
        'probe.png',
        'snapshot_final.png',
        'field.gif'
    )
    foreach ($artifact in $fdtdArtifacts) {
        $path = Join-Path 'output\fdtd1d' $artifact
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }
    Invoke-InEnvironment -Conda $conda -Arguments @(
        'build\release\fdtd1d.exe',
        '--mode', 'additive-abc',
        '--scale', 'normalized',
        '--grid-size', '120',
        '--time-steps', '240',
        '--source-index', '30',
        '--probe-index', '60',
        '--snapshot-interval', '10',
        '--output-dir', 'output\fdtd1d'
    )
    Invoke-InEnvironment -Conda $conda -Arguments @(
        'python', '-m', 'scripts.visualize_fdtd1d', 'output\fdtd1d'
    )
    foreach ($artifact in $fdtdArtifacts) {
        $path = Join-Path 'output\fdtd1d' $artifact
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Expected FDTD artifact is missing: $path"
        }
        if ((Get-Item -LiteralPath $path).Length -le 0) {
            throw "Expected FDTD artifact is empty: $path"
        }
    }
}
finally {
    Pop-Location
}

Write-Host 'Debug, Release, MPI, FDTD, GUI, Python, and plotting checks passed.'
