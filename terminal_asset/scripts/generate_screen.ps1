# Native Windows bitmap drawing. No downloaded wallpaper, logos, or external fonts.
# Repeatable Y2K desktop texture for the Blender CRT; content preserves the old terminal.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Split-Path $PSScriptRoot -Parent
$textureDir = Join-Path $assetRoot 'textures'
New-Item -ItemType Directory -Path $textureDir -Force | Out-Null
$parameters = @{ width=256; height=192; seed=63112028; filter='nearest'; content='ARCHIVE_LOCAL / OPEN LOG / READ TEXT'; fonts=@('Consolas','Microsoft YaHei') }
$bitmap = [System.Drawing.Bitmap]::new(256,192,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
$brushes = @{}
$fonts = @{}
function Brush([string]$hex) {
  if (-not $brushes.ContainsKey($hex)) { $brushes[$hex]=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex)) }
  return $brushes[$hex]
}
function Rect([int]$x,[int]$y,[int]$w,[int]$h,[string]$color) { $graphics.FillRectangle((Brush $color),$x,$y,$w,$h) }
function Ellipse([int]$x,[int]$y,[int]$w,[int]$h,[string]$color) { $graphics.FillEllipse((Brush $color),$x,$y,$w,$h) }
function Polygon([int[]]$values,[string]$color) {
  $points = [System.Collections.Generic.List[System.Drawing.Point]]::new()
  for($index=0;$index -lt $values.Length;$index+=2) { $points.Add([System.Drawing.Point]::new($values[$index],$values[$index+1])) }
  $graphics.FillPolygon((Brush $color),$points.ToArray())
}
function Text([string]$value,[int]$x,[int]$y,[string]$color,[int]$size=9,[string]$family='Consolas',[bool]$bold=$false) {
  $key="$family-$size-$bold"
  if (-not $fonts.ContainsKey($key)) {
    $style=if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
    $fonts[$key]=[System.Drawing.Font]::new($family,[single]$size,$style,[System.Drawing.GraphicsUnit]::Pixel)
  }
  $graphics.DrawString($value,$fonts[$key],(Brush $color),[single]$x,[single]$y,[System.Drawing.StringFormat]::GenericTypographic)
}
function Folder([int]$x,[int]$y,[string]$label) {
  Rect ($x+1) ($y+4) 20 14 '#31526d'
  Rect ($x+2) ($y+2) 9 5 '#e6cb73'
  Rect ($x+2) ($y+5) 18 11 '#e2c06c'
  Rect ($x+3) ($y+6) 16 2 '#f8e5a1'
  Text $label ($x-1) ($y+19) '#ffffff' 9 'Microsoft YaHei'
}
function WindowFrame([int]$x,[int]$y,[int]$w,[int]$h,[string]$title,[string]$bar='#143b78') {
  Rect ($x+2) ($y+2) $w $h '#344b55'
  Rect $x $y $w $h '#c6c9c3'
  Rect $x $y $w 1 '#f7f7ed'
  Rect $x $y 1 $h '#f7f7ed'
  Rect ($x+$w-1) $y 1 $h '#5c6a66'
  Rect $x ($y+$h-1) $w 1 '#5c6a66'
  Rect ($x+3) ($y+3) ($w-6) 13 $bar
  Text $title ($x+7) ($y+4) '#ffffff' 9 'Consolas' $true
  Rect ($x+$w-14) ($y+5) 8 8 '#d0d3c9'
  Text 'x' ($x+$w-13) ($y+3) '#243a50' 9
  Rect ($x+4) ($y+19) ($w-8) ($h-24) '#f5f5e8'
}

# A deliberately coarse sky gradient and broad green hills.
for($y=0;$y -lt 125;$y+=4) {
  $t=$y/125.0
  $r=[int](77+53*$t);$g=[int](147+42*$t);$b=[int](201+20*$t)
  $graphics.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($r,$g,$b)),0,$y,256,4)
}
Ellipse 14 16 37 9 '#dceaf0';Ellipse 25 10 19 12 '#edf2ec';Ellipse 40 20 28 7 '#dceaf0'
Ellipse 172 5 38 9 '#dbe9e9';Ellipse 189 1 22 10 '#edf3ee'
Polygon @(0,123,28,104,62,97,102,110,146,94,194,101,256,88,256,192,0,192) '#80ae54'
Polygon @(0,150,46,131,96,140,151,119,208,129,256,115,256,192,0,192) '#639843'
Polygon @(0,178,58,153,129,161,195,141,256,155,256,192,0,192) '#78a84d'
$random=[System.Random]::new($parameters.seed)
for($i=0;$i -lt 150;$i++) { $x=$random.Next(0,256);$y=$random.Next(143,181);Rect $x $y 2 1 '#89b158' }
Folder 12 18 '档案'
Folder 12 62 '缓存'

# Two ancillary windows and one legible main archive window.
WindowFrame 8 106 85 64 'FILES' '#4d778d'
Folder 16 129 ''
Text 'TEXT' 43 131 '#334e61' 9
Text 'LOCAL' 43 144 '#334e61' 8
WindowFrame 65 21 182 124 'ARCHIVE_LOCAL'
Text 'WEB / TERMINAL' 75 45 '#365871' 9 'Consolas' $true
Rect 75 60 161 1 '#b8c8b4'
Text '> OPEN LOG' 77 70 '#274a3e' 10
Text '> READ TEXT' 77 87 '#274a3e' 10
Text '蓝瘦香菇 / 难受，想哭' 75 106 '#1f493b' 10 'Microsoft YaHei'
Text '[E] 查阅资料' 75 126 '#305a7b' 9 'Microsoft YaHei'
WindowFrame 149 150 98 29 'STATUS' '#4a697d'
Text 'READY / LOCAL' 154 167 '#345347' 7

# Own envelope icon in the bottom bar; no copied operating-system marks.
Rect 0 181 256 11 '#c5cdc0';Rect 0 181 256 1 '#f5f7ea'
Rect 3 183 34 7 '#37684f';Rect 6 185 6 4 '#eee8c7'
Text '档案' 16 181 '#ffffff' 8 'Microsoft YaHei'
Text 'OLD WEB' 43 183 '#334b55' 8
Text 'LOCAL' 222 183 '#334b55' 8
$output = Join-Path $textureDir 'screen_desktop_256.png'
$bitmap.Save($output,[System.Drawing.Imaging.ImageFormat]::Png)
$parameters | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $textureDir 'screen-parameters.json') -Encoding UTF8
$graphics.Dispose();$bitmap.Dispose()
foreach($brush in $brushes.Values){$brush.Dispose()}
foreach($font in $fonts.Values){$font.Dispose()}
Write-Output "Generated $output (256 x 192)"
