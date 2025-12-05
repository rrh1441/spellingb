const fs = require('fs');
const path = require('path');

const words = ['zeitgeist', 'accommodate', 'entrepreneur', 'rhythm', 'necessary', 'beautiful', 'psychology', 'conscience', 'mischievous', 'hierarchy'];

async function generateOne(word) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: word,
      voice: 'onyx',
      response_format: 'mp3',
      speed: 0.75,
    }),
  });

  if (!response.ok) {
    console.log('Error for ' + word + ':', await response.text());
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const outDir = path.join(__dirname, '../test-audio');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, word + '.mp3'), buffer);
  console.log('Generated: ' + word + '.mp3');
}

async function run() {
  for (const word of words) {
    await generateOne(word);
  }
  console.log('\nDone! Check test-audio/ folder');
}

run();
