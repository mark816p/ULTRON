# ============================================================================
# U.L.T.R.O.N. Universal Neural Client Installer
# Supports All OS Architecture & Multi-Version Selection
# ============================================================================

$ErrorActionPreference = "Stop"
$RepoOwner = "mark816p"
$RepoName = "ultron-autonomous-orb"
$ApiUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/releases"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         U.L.T.R.O.N. UNIVERSAL NEURAL CLIENT INSTALLER               " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " Fetching available versions from GitHub repository..." -ForegroundColor Yellow

$releases = @()
try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Headers @{ "User-Agent" = "ULTRON-Installer" } -ErrorAction Stop
    foreach ($rel in $response) {
        $releases += [PSCustomObject]@{
            TagName = $rel.tag_name
            Name = if ($rel.name) { $rel.name } else { $rel.tag_name }
            Prerelease = $rel.prerelease
            Draft = $rel.draft
            Assets = $rel.assets
        }
    }
} catch {
    Write-Host " [!] GitHub API lookup offline or rate-limited. Using version registry..." -ForegroundColor DarkYellow
}

# Fallback default versions if API returns empty
if ($releases.Count -eq 0) {
    $releases = @(
        [PSCustomObject]@{ TagName = "v39.0.0"; Name = "v39.0.0 (Latest Release - High-Precision 3D Vision)"; Prerelease = $false },
        [PSCustomObject]@{ TagName = "v38.0.0"; Name = "v38.0.0 (Stable Release)"; Prerelease = $false },
        [PSCustomObject]@{ TagName = "v36.1.0"; Name = "v36.1.0 (Base Release)"; Prerelease = $false }
    )
}

$latestTag = $releases[0].TagName
Write-Host " [✓] Identified $( $releases.Count ) available release version(s). Default: $latestTag" -ForegroundColor Green
Write-Host ""

# Try launching GUI window
$selectedVersion = $null

Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

if ([System.Windows.Forms.Form] -and $Host.Name -notmatch "Server") {
    try {
        $form = New-Object System.Windows.Forms.Form
        $form.Text = "U.L.T.R.O.N. Universal Client Installer"
        $form.Size = New-Object System.Drawing.Size(520, 380)
        $form.StartPosition = "CenterScreen"
        $form.BackColor = [System.Drawing.Color]::FromArgb(12, 12, 16)
        $form.FormBorderStyle = "FixedDialog"
        $form.MaximizeBox = $false

        $label = New-Object System.Windows.Forms.Label
        $label.Text = "SELECT U.L.T.R.O.N. VERSION TO INSTALL:"
        $label.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
        $label.ForeColor = [System.Drawing.Color]::FromArgb(0, 240, 255)
        $label.Location = New-Object System.Drawing.Point(20, 20)
        $label.Size = New-Object System.Drawing.Size(460, 30)
        $form.Controls.Add($label)

        $panel = New-Object System.Windows.Forms.Panel
        $panel.Location = New-Object System.Drawing.Point(20, 60)
        $panel.Size = New-Object System.Drawing.Size(465, 200)
        $panel.AutoScroll = $true
        $panel.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 28)
        $form.Controls.Add($panel)

        $radioButtons = @()
        $yPos = 10

        for ($i = 0; $i -lt $releases.Count; $i++) {
            $rel = $releases[$i]
            $rb = New-Object System.Windows.Forms.RadioButton
            $rb.Text = "$($rel.TagName) - $($rel.Name)" + (if ($i -eq 0) { " (DEFAULT / LATEST)" } else { "" })
            $rb.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
            $rb.ForeColor = if ($i -eq 0) { [System.Drawing.Color]::FromArgb(0, 255, 102) } else { [System.Drawing.Color]::FromArgb(200, 200, 200) }
            $rb.Location = New-Object System.Drawing.Point(10, $yPos)
            $rb.Size = New-Object System.Drawing.Size(430, 28)
            $rb.Tag = $rel.TagName
            if ($i -eq 0) { $rb.Checked = $true }
            $panel.Controls.Add($rb)
            $radioButtons += $rb
            $yPos += 32
        }

        $btnInstall = New-Object System.Windows.Forms.Button
        $btnInstall.Text = "INSTALL SELECTED VERSION"
        $btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
        $btnInstall.BackColor = [System.Drawing.Color]::FromArgb(0, 240, 255)
        $btnInstall.ForeColor = [System.Drawing.Color]::Black
        $btnInstall.FlatStyle = "Flat"
        $btnInstall.Location = New-Object System.Drawing.Point(20, 275)
        $btnInstall.Size = New-Object System.Drawing.Size(465, 45)
        $btnInstall.Cursor = [System.Windows.Forms.Cursors]::Hand
        $btnInstall.Add_Click({
            foreach ($rb in $radioButtons) {
                if ($rb.Checked) {
                    $script:selectedVersion = $rb.Tag
                    break
                }
            }
            $form.Close()
        })
        $form.Controls.Add($btnInstall)

        $form.ShowDialog() | Out-Null
    } catch {
        $selectedVersion = $null
    }
}

# Console Fallback Selection if GUI was skipped or closed without selection
if (-not $selectedVersion) {
    Write-Host "Available Release Versions:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $releases.Count; $i++) {
        $tag = $releases[$i].TagName
        $name = $releases[$i].Name
        $isDefault = if ($i -eq 0) { " [DEFAULT]" } else { "" }
        Write-Host "  [$($i+1)] $tag - $name$isDefault" -ForegroundColor (if ($i -eq 0) { "Green" } else { "Gray" })
    }
    Write-Host ""
    Write-Host "Enter option number [1-$($releases.Count)] (Default is 1): " -NoNewline -ForegroundColor Yellow
    $choice = Read-Host
    if ([string]::IsNullOrWhiteSpace($choice) -or -not [int]::TryParse($choice, [ref]$null)) {
        $choiceIndex = 0
    } else {
        $choiceIndex = [int]$choice - 1
        if ($choiceIndex -lt 0 -or $choiceIndex -ge $releases.Count) { $choiceIndex = 0 }
    }
    $selectedVersion = $releases[$choiceIndex].TagName
}

Write-Host ""
Write-Host "----------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " [➔] Selected Version : $selectedVersion" -ForegroundColor Green
Write-Host "----------------------------------------------------------------------" -ForegroundColor Cyan

# Determine Target Asset Download URL
$downloadUrl = "https://github.com/$RepoOwner/$RepoName/releases/download/$selectedVersion/ULTRON-Setup.exe"
if ($selectedVersion -eq "latest" -or $selectedVersion -eq $releases[0].TagName) {
    $downloadUrl = "https://github.com/$RepoOwner/$RepoName/releases/latest/download/ULTRON-Setup.exe"
}

$tempDir = [System.IO.Path]::GetTempPath()
$targetFile = Join-Path $tempDir "ULTRON-Setup-$selectedVersion.exe"

Write-Host " [↓] Downloading $selectedVersion directly from GitHub..." -ForegroundColor Yellow
Write-Host "     Source: $downloadUrl" -ForegroundColor Gray
Write-Host "     Destination: $targetFile" -ForegroundColor Gray

try {
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($downloadUrl, $targetFile)
    Write-Host " [✓] Download complete! Size: $([math]::Round((Get-Item $targetFile).Length / 1MB, 2)) MB" -ForegroundColor Green
} catch {
    Write-Host " [!] Standard asset download failed. Attempting fallback bundle..." -ForegroundColor Yellow
    # Fallback to current release tag asset
    $fallbackUrl = "https://github.com/$RepoOwner/$RepoName/releases/download/v39.0.0/ULTRON-Setup.exe"
    try {
        (New-Object System.Net.WebClient).DownloadFile($fallbackUrl, $targetFile)
        Write-Host " [✓] Fallback download successful!" -ForegroundColor Green
    } catch {
        Write-Host " [X] Download failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host " Please visit https://github.com/$RepoOwner/$RepoName/releases manually." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host " [⚡] Launching U.L.T.R.O.N. Setup ($selectedVersion)..." -ForegroundColor Cyan
Start-Process -FilePath $targetFile

Write-Host " [✓] Installer session initiated successfully!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
