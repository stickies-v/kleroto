import { fingerprint as drawFingerprint, toCanonicalText, type Draw } from './draw';
import type { DrawResult } from './result';
import { QUICKNET } from './sources/drand';

export interface ManualStep {
  title: string;
  text: string;
  command: string;
  expected?: string;
  afterDraw?: boolean;
}

const RANDOM_PLACEHOLDER = '<random number>';
const FIRST_PARTICIPANT_LINE = 6;

export function manualSteps(draw: Draw, link: string, result: DrawResult | null): ManualStep[] {
  const fingerprint = drawFingerprint(draw);
  return [
    {
      title: 'Save the draw data',
      text: 'This is the text in the link. The command saves it as draw.txt in the current folder.',
      command: saveCommand(draw),
    },
    {
      title: 'Calculate the fingerprint',
      text: 'The first part of the output must be the fingerprint of this draw. On Linux, you can also use sha256sum.',
      command: 'shasum -a 256 draw.txt',
      expected: fingerprint,
    },
    {
      title: 'Optional: check that the link contains this data',
      text: 'This decodes the link itself. The output must be the same fingerprint.',
      command:
        `python3 -c 'import sys,zlib,base64;d=sys.argv[1].split("#v1.")[-1];` +
        `sys.stdout.buffer.write(zlib.decompress(base64.urlsafe_b64decode(d+"="*(-len(d)%4)),-15))' ` +
        `'${link}' | shasum -a 256`,
      expected: fingerprint,
    },
    randomnessStep(draw, result?.randomness),
    {
      title: 'Select the participants',
      text:
        'Each participant gets a ticket: the SHA256 of the fingerprint, the random number and the participant number. ' +
        `The script sorts the tickets and shows the ${draw.select === 1 ? 'lowest one' : `${draw.select} lowest`}.`,
      command: pickCommand(fingerprint, result?.randomness ?? RANDOM_PLACEHOLDER, draw.select),
      expected: result?.selected.map((index) => `${result.tickets[index]} ${draw.participants[index]}`).join('\n'),
      afterDraw: true,
    },
  ];
}

function saveCommand(draw: Draw): string {
  const text = toCanonicalText(draw);
  let delimiter = 'END_OF_DRAW';
  while (text.split('\n').includes(delimiter)) delimiter += '_';
  return `cat > draw.txt <<'${delimiter}'\n${text}${delimiter}`;
}

function randomnessStep(draw: Draw, randomness: string | undefined): ManualStep {
  if (draw.source.kind === 'bitcoin') {
    return {
      title: 'Get the random number',
      text: `This is the hash of Bitcoin block ${draw.source.height}. You can also find it on any block explorer.`,
      command: `curl -s -w '\\n' 'https://mempool.space/api/block-height/${draw.source.height}'`,
      expected: randomness,
      afterDraw: true,
    };
  }
  return {
    title: 'Get the random number',
    text: `This gets drand round ${draw.source.round}. The random number is the "randomness" field in the output.`,
    command: `curl -s -w '\\n' 'https://api.drand.sh/${QUICKNET.chainHash}/public/${draw.source.round}'`,
    expected: randomness && `"randomness":"${randomness}"`,
    afterDraw: true,
  };
}

function pickCommand(fingerprint: string, randomness: string, select: number): string {
  return `fingerprint=${fingerprint}
random=${randomness}
i=0
tail -n +${FIRST_PARTICIPANT_LINE} draw.txt | while IFS= read -r participant; do
  i=$((i + 1))
  printf '%s %s\\n' "$(printf '%s %s %s' "$fingerprint" "$random" "$i" | shasum -a 256 | cut -c1-64)" "$participant"
done | LC_ALL=C sort | head -n ${select}`;
}
