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
        Invoke-InEnvironment -Conda $conda -Arguments @(
            'cmake', '--preset', $preset, '--fresh'
        )
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
        'python',
        'scripts/plot_signal.py',
        'output/smoke/signal.csv',
        'output/smoke/signal.png'
    )

    $plot = Get-Item -LiteralPath 'output\smoke\signal.png'
    if ($plot.Length -le 0) {
        throw 'Generated signal plot is empty.'
    }
}
finally {
    Pop-Location
}

Write-Host 'Debug, Release, MPI, pthread, Python, and plotting checks passed.'
