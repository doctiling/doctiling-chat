---
description: Run the full gate and report evidence
---

Delegate to the `gate-runner` subagent with the instruction "run `npm run gate` and report".

- GREEN → state the verdict. That is the evidence.
- RED → read the actual error, form ONE hypothesis, fix the root cause, re-run. Never adjust an assertion or a check. After 2 failed attempts on the same error, stop and escalate with the diagnosis.
