# PROTOTYPE - NOT FOR PRODUCTION
# Synthesizes each radio line with a Windows OneCore voice (offline). Usage: synth.ps1 <manifest.json> <outdir>
param($manifest, $out)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$cast = @{ CAPCOM = @('Mark', '+8%', '-4%'); CDR = @('David', '+4%', '-10%'); LMP = @('Zira', '+10%', '+0%') }
$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
foreach ($l in (Get-Content $manifest -Raw | ConvertFrom-Json)) {
  $c = $cast[$l.who]
  $s.Voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ? { $_.DisplayName -like "*$($c[0])*" } | select -First 1
  $txt = [System.Security.SecurityElement]::Escape($l.say)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><prosody rate='$($c[1])' pitch='$($c[2])'>$txt</prosody></speak>"
  $stream = Await ($s.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $r = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0)); $n = [uint32]$stream.Size
  $null = Await ($r.LoadAsync($n)) ([uint32]); $b = New-Object byte[] $n; $r.ReadBytes($b)
  [IO.File]::WriteAllBytes((Join-Path $out "$($l.id).wav"), $b)
}
"done"
