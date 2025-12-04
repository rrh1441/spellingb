Audio
Learn how to turn audio into text or text into audio.

Related guide: Speech to text
Create speech
POST
 
https://api.openai.com/v1/audio/speech
Generates audio from the input text.

Request body
input
string
Required
The text to generate audio for. The maximum length is 4096 characters.
model
string
Required
One of the available TTS models: tts-1, tts-1-hd or gpt-4o-mini-tts.
voice
string
Required
The voice to use when generating the audio. Supported voices are alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, and verse. Previews of the voices are available in the Text to speech guide.
instructions
string
Optional
Control the voice of your generated audio with additional instructions. Does not work with tts-1 or tts-1-hd.
response_format
string
Optional
Defaults to mp3
The format to audio in. Supported formats are mp3, opus, aac, flac, wav, and pcm.
speed
number
Optional
Defaults to 1
The speed of the generated audio. Select a value from 0.25 to 4.0. 1.0 is the default.
stream_format
string
Optional
Defaults to audio
The format to stream the audio in. Supported formats are sse and audio. sse is not supported for tts-1 or tts-1-hd.