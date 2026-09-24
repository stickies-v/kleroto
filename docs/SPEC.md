# Kleroto v1 specification

This document gives the full rules to calculate a draw result. With these rules, you can check a result without this website. Each draw page also shows the shell commands for its own draw.

## 1. Canonical text

A draw is a UTF-8 text. Each line ends with one `\n` (0x0A), and the last line also ends with `\n`.

```
kleroto v1
title: <title>
select: <k>
source: <source>
participants: <n>
<participant 1>
<participant 2>
...
<participant n>
```

Rules:

- `<k>` and `<n>` are decimal integers with no leading zeros. `1 <= k <= n`.
- `<source>` is one of these:
  - `bitcoin <height>`: the Bitcoin block at this height.
  - `drand-quicknet <round>`: the drand quicknet round with this number.
- The title and each participant are not empty. They do not start or end with white space. They do not contain control characters, lone surrogates, U+2028 or U+2029.
- A participant can occur more than one time (each line is one ticket). The order of the participants is part of the draw.

Example:

```
kleroto v1
title: Who buys the cake?
select: 1
source: bitcoin 960000
participants: 5
Alice
Bob
Carol
Dave
Eve
```

## 2. Link

The link fragment (the part after `#`) is:

```
v1.<base64url(raw DEFLATE(canonical text))>
```

- Raw DEFLATE is RFC 1951, with no zlib or gzip header.
- base64url is RFC 4648 section 5, with no `=` padding.

The compressed bytes are not canonical. Different compressors can make different links for the same draw. The fingerprint uses only the decompressed text, so this has no effect on the result. A decoder must refuse a text that is not in canonical form.

## 3. Fingerprint

```
fingerprint = SHA256(canonical text as UTF-8 bytes)
```

Below, `<fingerprint>` is the fingerprint as 64 lowercase hex characters. It is the commitment to the draw.

## 4. Random value

The random value (`randomness`) is 32 bytes, written as 64 lowercase hex characters.

- **Bitcoin:** the block hash at the given height, as block explorers show it (big-endian, with the leading zeros). The website accepts the block when two APIs agree on the hash and the header has valid proof of work. It marks the result final after 3 confirmations.
- **drand quicknet:** the `randomness` of the round, which is `SHA256(signature)`. The website verifies the BLS signature with the quicknet public key before it uses the value.
  - Chain hash: `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`
  - Genesis time: 1692803367, period: 3 seconds
  - Round `r` is published at `genesis + (r - 1) * 3`.

## 5. Tickets

Each participant gets a ticket. For participant number `i` (1 for the first participant, in list order):

```
ticket_i = SHA256("<fingerprint> <randomness> <i>")
```

- `<fingerprint>` is the fingerprint as 64 lowercase hex characters.
- `<randomness>` is the random value as 64 lowercase hex characters.
- `<i>` is the participant number in decimal.
- There is one space between the three parts. The text is ASCII, with no newline.

## 6. Selection

Sort the participants by ticket, lowest first. Compare tickets as 64-character lowercase hex texts (this is the same as numeric order). The first `k` participants are selected: the first one is the first place, and so on. If `k = n`, the result is a full random order.

Two tickets are equal with a probability of about 2^-256. If this occurs, the lower participant number comes first.

Shell example, with `draw.txt` from section 1:

```sh
fingerprint=$(shasum -a 256 < draw.txt | cut -c1-64)
random=<randomness>
i=0
tail -n +6 draw.txt | while IFS= read -r participant; do
  i=$((i + 1))
  printf '%s %s\n' "$(printf '%s %s %s' "$fingerprint" "$random" "$i" | shasum -a 256 | cut -c1-64)" "$participant"
done | LC_ALL=C sort | head -n <k>
```

## 7. Test vectors

`tests/vectors.json` has vectors for the link, the fingerprint and the selected participants with their tickets. The TypeScript tests and the shell test (`tests/manual.test.ts`) use this file. The shell test runs the command-line steps with `sh`, `shasum` and `sort`, so it is an independent implementation of the rules.
