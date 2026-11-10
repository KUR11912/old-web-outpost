# Archive storefront lettering, drawn with local Windows fonts and simple pixels.
# UV target sizes: vertical board .52 x 2.70 m; curved awning approximately 4.8 x 1.2 m.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot=Split-Path $PSScriptRoot -Parent
$textureRoot=Join-Path $assetRoot 'textures'
New-Item -ItemType Directory -Path $textureRoot -Force | Out-Null
$seed=63112029
$brushes=@{}
function Brush([string]$hex) {
  if(-not $brushes.ContainsKey($hex)){$brushes[$hex]=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))}
  return $brushes[$hex]
}
function Setup([System.Drawing.Bitmap]$bitmap) {
  $g=[System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::None
  $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  return $g
}
$vertical=[System.Drawing.Bitmap]::new(128,256)
$g=Setup $vertical
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#cec8b7'))
$random=[System.Random]::new($seed)
for($i=0;$i -lt 450;$i++){
  $tone=if($i%2 -eq 0){'#c4c0ae'}else{'#d5cfbf'}
  $g.FillRectangle((Brush $tone),$random.Next(5,123),$random.Next(5,251),$random.Next(1,6),$random.Next(1,4))
}
$g.FillRectangle((Brush '#696e68'),0,0,5,256);$g.FillRectangle((Brush '#696e68'),123,0,5,256)
$g.FillRectangle((Brush '#e6dfcc'),5,3,118,3);$g.FillRectangle((Brush '#7b7a6d'),5,250,118,3)
$font=[System.Drawing.Font]::new('Microsoft YaHei',72,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$sy=[single](.52/2.70*256/128)
$letters=@('回','声','档','案','馆')
for($i=0;$i -lt $letters.Count;$i++){
  $size=$g.MeasureString($letters[$i],$font,[System.Drawing.PointF]::new(0,0),[System.Drawing.StringFormat]::GenericTypographic)
  $g.ScaleTransform(1,$sy)
  $g.DrawString($letters[$i],$font,(Brush '#865f58'),[single]((128-$size.Width)/2),[single]((12+$i*47)/$sy),[System.Drawing.StringFormat]::GenericTypographic)
  $g.ResetTransform()
}
$vertical.Save((Join-Path $textureRoot 'vertical_sign_128x256.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose();$g.Dispose();$vertical.Dispose()

$awning=[System.Drawing.Bitmap]::new(256,128)
$g=Setup $awning
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#ab7582'))
$random=[System.Random]::new($seed+1)
for($i=0;$i -lt 1700;$i++){
  $tone=@('#ae7b87','#a16e7b','#b5838d','#a87280')[$random.Next(0,4)]
  $g.FillRectangle((Brush $tone),$random.Next(0,256),$random.Next(0,128),$random.Next(1,8),$random.Next(1,6))
}
# Sparse faded fabric seams and darker lower hem.
foreach($x in @(0,51,102,153,204,255)){
  $g.FillRectangle((Brush '#976a75'),$x,0,1,128)
  $g.FillRectangle((Brush '#b78a94'),($x+1),0,1,123)
}
$g.FillRectangle((Brush '#8a606e'),0,123,256,5)
$g.FillRectangle((Brush '#b78a91'),0,4,256,2)
# A simple envelope: the only pictorial mark, kept in the archive theme.
$g.FillRectangle((Brush '#c9beb0'),19,78,32,22)
$pen=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#966773'),2)
$g.DrawRectangle($pen,19,78,32,22)
$g.DrawLine($pen,20,79,35,90);$g.DrawLine($pen,35,90,50,79)
$pen.Dispose()
$font=[System.Drawing.Font]::new('Microsoft YaHei',35,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$g.ScaleTransform([single]0.65,[single]1.0)
$g.DrawString('旧网资料室',$font,(Brush '#d4c5b8'),[single](78/.65),[single]63,[System.Drawing.StringFormat]::GenericTypographic)
$g.ResetTransform();$font.Dispose()
$small=[System.Drawing.Font]::new('Consolas',9,[System.Drawing.FontStyle]::Regular,[System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('READ / RECALL / ARCHIVE',$small,(Brush '#d3c2b6'),[single]78,[single]107,[System.Drawing.StringFormat]::GenericTypographic)
$small.Dispose()
$awning.Save((Join-Path $textureRoot 'awning_archive_256.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$awning.Dispose()
foreach($brush in $brushes.Values){$brush.Dispose()}
@{seed=$seed;vertical=@{pixels=@(128,256);width=.52;height=2.7;glyphScaleY=$sy};awning=@{pixels=@(256,128);text='旧网资料室';ownIcon='envelope'}} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $textureRoot 'sign-parameters.json') -Encoding UTF8
Write-Output 'Generated archive storefront lettering textures.'
