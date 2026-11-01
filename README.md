# Guitar Builder

Build, measure and voice your instruments. Guitar Builder helps luthiers in five ways:
- follow a 132-step build process, with notes, photos and measurements for each step;
- capture tap tones and analyze them;
- compute tonewood properties and target plate thickness;
- simulate a guitar body's response;
- ask questions of an AI assistant grounded in a reference library.

This repository is a rewrite of [the original app](https://github.com/PierreLeducTLM/GuitarBuilder).

## Where things are

| Path | What it holds |
|---|---|
| `openspec/specs/` | The behavior of every capability, in [OpenSpec](https://github.com/Fission-AI/OpenSpec) format. This is the source of truth. |
| `openspec/config.yaml` | Project context: stack, design direction and spec-writing rules |
| `openspec/changes/` | Work in progress, one folder per change |
| `docs/rewrite/` | Why the rewrite exists, the owner's decisions, and an audit of the legacy app |
| `docs/reference-data/` | Measured tonewood data used as test fixtures |

## Working on it

Changes follow the OpenSpec workflow: propose a change, implement it, then archive it into the specs. With Claude Code, use `/opsx:propose`, `/opsx:apply` and `/opsx:archive`. Engineering conventions are in [`CLAUDE.md`](CLAUDE.md).
