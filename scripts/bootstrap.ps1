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

function Invoke-CondaCommand {
    param(
        [string]$Conda,
        [string[]]$Arguments
    )

    & $Conda @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Conda command failed: conda $($Arguments -join ' ')"
    }
}

function Get-PackageState {
    param(
        [string]$Conda,
        [string]$Environment
    )

    $json = & $Conda list -n $Environment --json
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot inspect Conda environment: $Environment"
    }
    $packages = ($json -join "`n") | ConvertFrom-Json
    return ($packages | Sort-Object name | ForEach-Object {
        "$($_.name)=$($_.version)=$($_.build_string)=$($_.channel)"
    }) -join "`n"
}

$conda = Get-CondaExecutable
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot 'environment.yml'
$baseBefore = Get-PackageState -Conda $conda -Environment 'base'
$cppBefore = Get-PackageState -Conda $conda -Environment 'cpp_env'

$environmentJson = & $conda env list --json
if ($LASTEXITCODE -ne 0) {
    throw 'Cannot inspect the available Conda environments.'
}
$environments = (($environmentJson -join "`n") | ConvertFrom-Json).envs
$targetExists = $environments | Where-Object {
    (Split-Path -Leaf $_) -eq 'ufdtd-c'
}

if ($targetExists) {
    Invoke-CondaCommand -Conda $conda -Arguments @(
        'env', 'update', '-n', 'ufdtd-c', '-f', $environmentFile
    )
} else {
    Invoke-CondaCommand -Conda $conda -Arguments @(
        'env', 'create', '-f', $environmentFile
    )
}

if ($baseBefore -ne (Get-PackageState -Conda $conda -Environment 'base')) {
    throw 'The Conda base environment changed unexpectedly.'
}
if ($cppBefore -ne (Get-PackageState -Conda $conda -Environment 'cpp_env')) {
    throw 'The cpp_env environment changed unexpectedly.'
}

Invoke-CondaCommand -Conda $conda -Arguments @(
    'run', '-n', 'ufdtd-c', '--no-capture-output', 'gcc', '--version'
)
Invoke-CondaCommand -Conda $conda -Arguments @(
    'run', '-n', 'ufdtd-c', '--no-capture-output', 'cmake', '--version'
)
Invoke-CondaCommand -Conda $conda -Arguments @(
    'run', '-n', 'ufdtd-c', '--no-capture-output', 'ninja', '--version'
)
Invoke-CondaCommand -Conda $conda -Arguments @(
    'run', '-n', 'ufdtd-c', '--no-capture-output', 'python', '--version'
)
Invoke-CondaCommand -Conda $conda -Arguments @(
    'run', '-n', 'ufdtd-c', '--no-capture-output', 'mpiexec', '-help'
)

Write-Host 'The ufdtd-c environment is ready.'
