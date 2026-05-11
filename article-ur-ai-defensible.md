:::lead
If you run utilization review at a payer, TPA, IRO, PBM, or managed care organization, you are about to be sold a lot of AI. Most of it will demo well. Some of it will pilot well. Much of it will struggle the first time a determination is challenged, an auditor asks how the system moved from documentation to denial, or a physician reviewer overrides the AI and you need to explain why.
:::

Foundation models are extraordinarily capable, and they will become part of UR workflows. The question is not whether to use AI. It is **which architecture you can defend eighteen months from now**.

The difference between AI you can deploy in regulated decision work and AI you cannot is rarely visible in the demo. It shows up later — when the system has to be defended, debugged, or improved. Three questions cut through the marketing faster than any feature checklist.

:::framework
THE GTS OPERATING FRAMEWORK · GTS COMAND
Three questions. Three disciplines. One standard for **defensible AI**.
01 | Control | Where does the human approval gate sit, and what happens when no reviewer acts before a determination goes out?
02 | Evaluate | How do you measure whether the AI was right — and is your evaluator deterministic or just another probabilistic model?
03 | Improve | When the AI is wrong, what exactly do you change, and how long does targeted, traceable remediation take?
:::

---

## Question 01 — Control | Where does the **human approval gate** sit, and what happens when no reviewer acts?

The right answer is that any AI-generated determination that leaves the system does so only after an explicit authorization step appropriate to the decision type, risk level, and governing rules. For adverse or complex determinations, that means affirmative approval by the credentialed reviewer, with an immutable record of that approval.

:::image mid
Diagram — Approval Gate Flow | AI draft → reviewer gate → authorized release
:::

:::warn
**Red Flag Answer**
"The AI generates the determination and your reviewer can review it." That is not a control. That is a hope that your reviewer is paying attention under production volume. **Vigilance does not scale**, and any architecture that depends on it is a compliance risk.
:::

A useful follow-up: ask the vendor what happens when a queued determination approaches a statutory or contractual deadline without reviewer action. Does the system escalate to the right human, lock external release, preserve the audit trail, and record the missed or late action? Or does it silently release the determination because the clock ran out?

The correct system does not silently release anything. It escalates, records the event, preserves the audit trail, and prevents external release unless the required authorization occurs. You cannot manage what you cannot control.

:::quote-dark
The approval gate is where the management of an AI agent actually begins. Everything upstream is generation. Everything downstream is accountability.
— Control Principle · GTS COMAND
:::

---

## Question 02 — Evaluate | How do you measure whether the AI was right — and is your **evaluator deterministic?**

*This is the question that separates serious architectures from impressive demos.*

If the answer is some variant of "we use another AI model to score the first model's output," you are looking at a probabilistic system evaluated by another probabilistic system. The two share training distributions, biases, and blind spots. When they agree, you have correlated probability. You do not have correctness.

A defensible answer connects evaluation to a deterministic source: a structured representation of the applied guideline — MTUS, ODG, ACOEM, the relevant National Coverage Determination — with explicit criteria and explicit satisfaction logic. The system does not just say "this met medical necessity." It says **which criterion was satisfied, what evidence satisfied it, and how that evidence was extracted from the clinical record**.

:::image mid
Diagram — Probabilistic vs. Deterministic Evaluation | Model-on-model scoring vs. rules engine
:::

:::warn
**Red Flag Answer**
"We have proprietary scoring." That is not a methodology — it describes a black box. **Black-box evaluation layers are difficult to defend under regulatory scrutiny.** If the vendor cannot articulate criteria, satisfaction logic, and source linkage in specific terms, you cannot verify correctness.
:::

:::quote
You cannot improve what you cannot measure. Evaluation against a deterministic reference — not against another model — is the precondition for everything that comes next.
— Evaluation Principle · GTS COMAND
:::

---

## Question 03 — Improve | When the AI is wrong, **what exactly do you change** — and how long does it take?

Every system is wrong some of the time. The question is what happens next.

**A weak answer:** "We retrain the model." Retraining can be versioned, but it is a blunt remediation path. It changes behavior diffusely, requires broad regression testing, and makes it difficult to prove that a targeted guideline correction did not affect unrelated decisions. In a regulated environment, diffuse change is a version control problem.

**A good answer:** errors are localized. A misextracted clinical fact is fixed in the extraction layer. A misapplied guideline is fixed in the structured guideline representation. A new piece of evidence is added to the relevant criterion. Each fix is targeted, traceable, and does not regress unrelated determinations.

:::image mid
Diagram — Layered Remediation Architecture | Extraction · Guideline representation · Evidence criteria
:::

:::quote-dark
Can you replay a determination from twelve months ago against the exact rule set, evidence state, extraction output, model version, and reviewer action history that existed at the time?
— The Temporal Versioning Test
:::

If the answer is no, the system cannot demonstrate why a determination from twelve months ago was reached on the logic that was then in effect. If the answer is yes, you have temporal versioning, and you can defend any prior decision on the rules and the actions that produced it.

This is the difference between a system that improves over time and a system that drifts. In a regulated environment, **drift is a liability you cannot manage**.

---

## In Practice | What this looks like in a **real procurement conversation**

Run these three questions in a real procurement conversation and the field thins quickly. Vendors selling probabilistic-on-probabilistic architectures will talk around the second question. Vendors without a real control plane will reframe the first question as "trust your reviewers." Vendors built on retraining loops will treat the third question as a roadmap item.

The vendors who pass all three are not the ones with the loudest marketing. They are the ones who have made architectural commitments that match the standard the work actually requires.

:::info
**Key Insight**
These questions are not anti-AI. They are **pro-deployment**. Foundation models should make reviewers faster and better informed. They should not be the unchecked source of regulated determinations.
:::

That is the lens worth bringing into every demo. Not "is this AI impressive," but **"is this AI defensible."** The first question is fun. The second is the one that determines whether you can still operate the system in eighteen months without an incident.
