# subnet-planner

Interactive subnet calculator, block splitter and **VLSM planner** that runs
entirely in the browser. Vanilla JavaScript ES modules, no dependencies, no
build step, no server — open `index.html` and it works.

Companion to [net-toolkit](https://github.com/5amuel02/net-toolkit) (the same
maths on the command line) and the
[network-lab-visualizer](https://github.com/5amuel02/network-lab-visualizer).

## What it does

**Calculator** — paste a block and get the network address, broadcast, mask,
wildcard, host range, address count, class and scope. Accepts every notation
people actually type:

```
192.168.1.0/24
192.168.1.0/255.255.255.0
192.168.1.0 255.255.255.0
192.168.1.7            (treated as a /32 host route)
```

**32-bit ruler** — the network portion of the address is highlighted bit by
bit, so the prefix boundary stops being an abstraction.

**Splitter** — drag the slider to cut the block into equal children and read
off every resulting subnet.

**VLSM planner** — enter each department and how many hosts it needs. Blocks
are packed largest-first (the only order that avoids alignment padding), and
the result shows what was allocated, how much each subnet wastes, and the
leftover space expressed as the fewest aligned CIDR blocks.

**Exports** — copy or download the plan as CSV, Markdown, JSON, or Cisco
interface stanzas.

**Shareable links** — the whole plan lives in the URL hash, so a worked
example can be handed to someone else as a link.

## Worked example

`192.168.1.0/24` with Sales 50, Engineering 30, Guest 12, WAN link 2:

| Name | CIDR | Mask | First host | Last host | Needed | Usable | Wasted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sales | 192.168.1.0/26 | 255.255.255.192 | 192.168.1.1 | 192.168.1.62 | 50 | 62 | 12 |
| Engineering | 192.168.1.64/27 | 255.255.255.224 | 192.168.1.65 | 192.168.1.94 | 30 | 30 | 0 |
| Guest | 192.168.1.96/28 | 255.255.255.240 | 192.168.1.97 | 192.168.1.110 | 12 | 14 | 2 |
| WAN link | 192.168.1.112/31 | 255.255.255.254 | 192.168.1.112 | 192.168.1.113 | 2 | 2 | 0 |

Free afterwards: `192.168.1.114/31`, `192.168.1.116/30`, `192.168.1.120/29`,
`192.168.1.128/25` — 142 addresses.

## /31 and /30

By default a two-host link is sized as a `/31`, which is correct under
RFC 3021: a point-to-point link has no broadcast address and both addresses
are usable. Plenty of coursework and older equipment still expects a `/30`, so
**Allow /31 for point-to-point links** turns that off and the same link is
sized as a `/30` instead.

## Running it

```sh
git clone https://github.com/5amuel02/subnet-planner
cd subnet-planner
python -m http.server 8080      # ES modules need http://, not file://
```

Then open <http://localhost:8080>.

## Tests

The address maths is covered by the Node test runner — no test framework to
install:

```sh
npm test
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>/</kbd> | focus the network block field |
| <kbd>a</kbd> | run the VLSM allocation |
| <kbd>n</kbd> | add a requirement row |
| <kbd>t</kbd> | cycle theme (auto / light / dark) |
| <kbd>l</kbd> | switch language (Indonesian / English) |
| <kbd>?</kbd> | shortcut help |

## Layout

```
index.html      markup only
styles.css      tokens, light and dark themes
app.js          panel rendering and event wiring
src/ipv4.js     address parsing, formatting, binary and hex
src/mask.js     prefixes, masks, wildcards, CIDR notation
src/subnet.js   network geometry, host ranges, scopes, containment
src/split.js    equal splitting and range-to-CIDR cover
src/vlsm.js     the allocator
src/export.js   CSV, Markdown, JSON, Cisco output
src/i18n.js     Indonesian and English copy
```

## Known limitations

- IPv4 only.
- Validation messages are English only, even when the interface is set to
  Indonesian — they come from the core modules, which carry no translations.

## License

MIT
