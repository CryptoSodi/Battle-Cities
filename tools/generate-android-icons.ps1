Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'mobile\assets\battle-cities-icon.png'
$resPath = Join-Path $root 'mobile\android\app\src\main\res'
$source = [System.Drawing.Image]::FromFile($sourcePath)

$densities = @{
    mdpi = @{ Legacy = 48; Adaptive = 108 }
    hdpi = @{ Legacy = 72; Adaptive = 162 }
    xhdpi = @{ Legacy = 96; Adaptive = 216 }
    xxhdpi = @{ Legacy = 144; Adaptive = 324 }
    xxxhdpi = @{ Legacy = 192; Adaptive = 432 }
}

function Write-Icon {
    param(
        [int]$Size,
        [double]$ArtworkScale,
        [string]$Destination,
        [bool]$Transparent
    )

    $bitmap = New-Object System.Drawing.Bitmap(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.Clear($(if ($Transparent) {
            [System.Drawing.Color]::Transparent
        } else {
            [System.Drawing.Color]::Black
        }))
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $artworkSize = [Math]::Round($Size * $ArtworkScale)
        $offset = [Math]::Floor(($Size - $artworkSize) / 2)
        $graphics.DrawImage($source, $offset, $offset, $artworkSize, $artworkSize)
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Write-Splash {
    param(
        [int]$Width,
        [int]$Height,
        [double]$ArtworkScale,
        [string]$Destination
    )

    $bitmap = New-Object System.Drawing.Bitmap(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.Clear([System.Drawing.Color]::Black)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $artworkSize = [Math]::Round([Math]::Min($Width, $Height) * $ArtworkScale)
        $left = [Math]::Floor(($Width - $artworkSize) / 2)
        $top = [Math]::Floor(($Height - $artworkSize) / 2)
        $graphics.DrawImage($source, $left, $top, $artworkSize, $artworkSize)
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    foreach ($density in $densities.Keys) {
        $directory = Join-Path $resPath "mipmap-$density"
        $sizes = $densities[$density]

        Write-Icon $sizes.Legacy 0.90 (Join-Path $directory 'ic_launcher.png') $false
        Write-Icon $sizes.Legacy 0.90 (Join-Path $directory 'ic_launcher_round.png') $false
        Write-Icon $sizes.Adaptive 0.74 `
            (Join-Path $directory 'ic_launcher_foreground.png') $true
    }

    $splashes = @(
        @{ Directory = 'drawable'; Width = 480; Height = 320; Scale = 0.76 },
        @{ Directory = 'drawable-land-mdpi'; Width = 480; Height = 320; Scale = 0.76 },
        @{ Directory = 'drawable-land-hdpi'; Width = 800; Height = 480; Scale = 0.76 },
        @{ Directory = 'drawable-land-xhdpi'; Width = 1280; Height = 720; Scale = 0.76 },
        @{ Directory = 'drawable-land-xxhdpi'; Width = 1600; Height = 960; Scale = 0.76 },
        @{ Directory = 'drawable-land-xxxhdpi'; Width = 1920; Height = 1280; Scale = 0.76 },
        @{ Directory = 'drawable-port-mdpi'; Width = 320; Height = 480; Scale = 0.86 },
        @{ Directory = 'drawable-port-hdpi'; Width = 480; Height = 800; Scale = 0.86 },
        @{ Directory = 'drawable-port-xhdpi'; Width = 720; Height = 1280; Scale = 0.86 },
        @{ Directory = 'drawable-port-xxhdpi'; Width = 960; Height = 1600; Scale = 0.86 },
        @{ Directory = 'drawable-port-xxxhdpi'; Width = 1280; Height = 1920; Scale = 0.86 }
    )

    foreach ($splash in $splashes) {
        Write-Splash `
            $splash.Width `
            $splash.Height `
            $splash.Scale `
            (Join-Path $resPath "$($splash.Directory)\splash.png")
    }
} finally {
    $source.Dispose()
}
