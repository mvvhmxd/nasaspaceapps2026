# PROTOTYPE - NOT FOR PRODUCTION
# Walkie-talkie treatment: narrow band, hard compression, soft clipping, light grit, a hiss bed with lead-in and tail.
FF="$1"; in="$2"; out="$3"
"$FF" -v error -y -i "$in" -filter_complex "[0:a]aresample=16000,highpass=f=380,highpass=f=380,lowpass=f=2800,lowpass=f=2800,equalizer=f=1700:t=q:w=1.2:g=5,acompressor=threshold=0.06:ratio=10:attack=2:release=80:makeup=5,asoftclip=type=atan:param=1.6,acrusher=bits=10:mode=log:mix=0.25,volume=0.8,adelay=150,apad=pad_dur=0.2[v];anoisesrc=r=16000:color=pink:amplitude=0.03,highpass=f=600,lowpass=f=3600[n];[v][n]amix=inputs=2:duration=first:normalize=0" -ac 1 -ar 16000 -c:a libmp3lame -b:a 32k "$out"
