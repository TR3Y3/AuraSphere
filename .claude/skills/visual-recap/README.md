# /visual-recap

Turn an existing change into a scannable visual review surface.

`/visual-recap` is the reverse of `/visual-plan`: instead of planning a future
change, it summarizes a diff, branch, commit, or PR after the work exists. The
goal is to help reviewers understand the shape of a change before they dive into
raw line-by-line diffs.

The recap is a human-optimized MDX document with custom components for the
things raw diffs are bad at explaining: annotated diffs, diagrams, visual schema
maps, OpenAPI-style API diffs, file maps, UI state summaries, and focused review
notes.

## What It Does

- Reads the actual changed files and diff.
- Publishes an Agent-Native Plan recap with file maps, diagrams, visual schema
  maps, API diffs, annotated diffs, UI state summaries, and focused key changes.
- Keeps recaps substantial enough for real review without dumping every line.
- Makes large changes consumable before a reviewer opens raw GitHub diff view.
- Can be installed with a reusable GitHub Action for PR visual recaps.

## When To Use It

Use it for PRs or work units that are large, multi-file, UI-heavy, or touch
schema, API contracts, permissions, architecture, or review-critical behavior.

Skip it for tiny, obvious diffs that review faster directly in GitHub.

## What Reviewers Get

Reviewers get the shape of the change first: what moved, which contracts
changed, what data or API surfaces were touched, how UI states differ, and where
the risky lines are. Then they can review the raw diff with a map in their head.

## GitHub Action

When installed with `--with-github-action`, this repo writes a PR workflow that
can generate a visual recap from a pull request diff.

## Install

```sh
npx @agent-native/skills add --skill visual-recap --with-github-action
```

The skill expects the Agent-Native Plan MCP connector to be available when it is
used, unless local-files privacy mode is explicitly enabled.
