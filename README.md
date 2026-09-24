# Kleroto

**The random draw that's simple and secure.**

Kleroto draws names with one link. Nobody can know or change the result in advance, and anyone can check it afterwards, without trusting this website. It is also simple: no accounts and no app.

The name comes from the *kleroterion*, the stone machine that ancient Athens used to pick citizens at random for juries and public offices, so that nobody could rig the choice.

## How it works

1. The organizer writes a list of participants and how many to select, and picks a draw oracle: drand (an exact draw time, the default) or a Bitcoin block height.
2. The tool makes a link. The link contains the full draw. If someone changes one name, the link changes too.
3. The organizer shares the link, for example in a group chat, before the draw time.
4. At the draw time, a public random value decides. Each participant gets a lottery ticket, `SHA256("<fingerprint> <random value> <participant number>")`, and the lowest tickets are selected. Every browser calculates the same result.

## Two draw oracles

| | drand quicknet (default) | Bitcoin block |
|---|---|---|
| The organizer picks | a date and time | a block height (the page shows the estimated time) |
| Draw time | the exact second | an estimate (blocks come at random intervals) |
| Relies on | a group of independent organizations (League of Entropy) | no organization |
| Random value | the round randomness | the block hash |
| Browser check | BLS signature against the quicknet public key | two APIs must agree, and the header must have valid proof of work |

## Trust

- Nobody can know the random value before the draw time, not even the organizer.
- The draw is fair only if everyone got the link before the draw time. A shared group chat gives this proof.
- Anyone can check a result without this website. Each draw page shows the command-line steps for that draw (under "Why this draw is provably fair" → "How does it work exactly?"). They use only `sh`, `shasum`, `curl` and `sort`, and each step shows its expected output. `tests/manual.test.ts` runs these commands for all test vectors.

The full algorithm is in [docs/SPEC.md](docs/SPEC.md).

## Development

```sh
npm install
npm run dev        # local server at http://localhost:5173
npm test           # tests, including the command-line steps
npm run build      # static site in dist/
```

To update the test vectors after an intentional change to the algorithm:

```sh
UPDATE_VECTORS=1 npm test
```

A change to the algorithm changes the results of existing links. Do not do this for `v1`. Make a `v2` format instead.

## Configuration

The app name, the tagline and the repository URL are in `src/config.ts`. The placeholder examples are in `src/examples.ts`.

## Deploy

At the moment, Kleroto is a static site. The workflow in `.github/workflows/pages.yml` tests, builds and deploys it to GitHub Pages on each push to `main`. In the repository settings, set **Pages → Source** to **GitHub Actions**.

## Vibe coded

Most of the code in this project was produced by an AI assistant, and is largely unreviewed.

## License

MIT. See [LICENSE](LICENSE).
