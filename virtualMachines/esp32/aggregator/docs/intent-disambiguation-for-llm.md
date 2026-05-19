# Intent Disambiguation for LLM-Backed Chat APIs

## The Core Idea

When a user sends a vague or ambiguous query to an LLM-backed chat endpoint, two things help the model give a useful response:

1. **A generic label** that names the broad class of thing being asked  
2. **A set of specific interpretations** (with examples) that map that generic label to concrete, answerable forms

Instead of the model guessing what the user meant, it receives a structured description of *what this kind of question usually means* and *what information it needs to answer it*. This allows the model to either pick the right interpretation confidently, or ask a targeted clarification question rather than producing a vague or wrong response.

---

## Why This Works

LLMs perform better when the ambiguity space is pre-bounded. Without guidance, a model asked "are all transactions settled?" must infer:
- What "all" means (all in the system? a batch? a time window?)
- What "settled" means (a lifecycle state? a queue position? an accounting status?)
- What the expected output is (yes/no? a list? a count?)

With a generic label (`settlement-inquiry`) and a set of named interpretations, the model:
1. Recognises the generic category from the query
2. Scores each specific interpretation against what was actually said
3. Picks the highest-confidence interpretation **and executes it**, or
4. Asks the user to choose from the interpretations if confidence is too low

This is the same principle behind intent taxonomies in commercial NLU platforms (Dialogflow, LUIS, Rasa) but applied at the prompt level, without a separate training pipeline.

---

## The Pattern

### Step 1 — Define a Generic Intent Category

Give it a name, a description of the abstract thing being asked, and the conditions that trigger it.

```json
{
  "id": "settlement-inquiry",
  "description": "The user wants to know whether one or more transactions have reached a settled or reconciled state.",
  "triggers": [
    "settled", "reconciled", "cleared", "complete", "done", "processed"
  ],
  "requiredSlots": ["references"],
  "optionalSlots": ["timeWindow", "counterparty"]
}
```

### Step 2 — Define Specific Interpretations

Each interpretation is a concrete, answerable form of the generic intent. Include:
- A **label** (human-readable)
- An **example** utterance (few-shot anchor)
- The **required parameters** to execute it
- The **API action** that fulfils it

```json
[
  {
    "id": "settlement-summary-by-refs",
    "label": "Check whether specific references are settled",
    "example": "are these references settled: REF1, REF2, REF3",
    "requiredParams": ["references"],
    "action": "GET /api/fsm/entities/{ref}"
  },
  {
    "id": "settlement-count-all",
    "label": "Count how many transactions are in a settled state",
    "example": "how many transactions have settled today",
    "requiredParams": ["timeWindow"],
    "action": "GET /api/fsm/summary?state=reconciled&since={timeWindow}"
  },
  {
    "id": "settlement-status-single",
    "label": "Check the current state of one transaction",
    "example": "where is transaction REF202605180001",
    "requiredParams": ["reference"],
    "action": "GET /api/fsm/entities/{reference}"
  }
]
```

### Step 3 — Feed This to the LLM as a System Prompt Fragment

Rather than hard-coding branching logic in backend code, give the model the taxonomy directly. The model can then reason about which interpretation best matches the user's phrasing.

```
You are a payment operations assistant. When a user asks about settlement status,
use the following interpretations to decide how to respond:

GENERIC INTENT: settlement-inquiry
Description: The user wants to know whether one or more transactions are settled.

INTERPRETATIONS:
1. settlement-summary-by-refs — Check whether specific references are settled
   Example: "are these references settled: REF1, REF2, REF3"
   Required: a list of transaction references

2. settlement-count-all — Count settled transactions
   Example: "how many transactions have settled today"
   Required: a time window

3. settlement-status-single — Single transaction status
   Example: "where is transaction REF202605180001"
   Required: one reference

INSTRUCTIONS:
- If the user's message matches one interpretation with high confidence and all
  required parameters are present, answer directly.
- If required parameters are missing, ask for them by name.
- If the message could match more than one interpretation at similar confidence,
  present the interpretations as options and ask the user to choose.
- Never guess a reference identifier. Always ask if not provided.
```

---

## How This Applies to the Pulse Chat API

The current `/api/fsm/chat` endpoint already implements this pattern partially in code (the `isSettlementSummaryInquiry` / `extractEntityRefsFromInquiry` pair). The next step is to externalise the intent taxonomy so it drives the model's reasoning rather than being hard-coded branching logic.

### Current State (code-driven)

```
query → regex detection → branch → clarification or execution
```

### Target State (model-driven with taxonomy)

```
query + intent-taxonomy → LLM reasoning → structured intent response
                                        → execute or ask for slot
```

### Practical Migration Steps

1. **Extract the intent manifest** into a JSON file (e.g. `data/intent-taxonomy.json`) using the schema above.
2. **Load it at startup** and inject a summary into the system prompt for every chat request.
3. **Ask the model to return structured JSON** for its intent decision before generating the user-facing reply:
   ```json
   {
     "genericIntent": "settlement-inquiry",
     "specificIntent": "settlement-summary-by-refs",
     "confidence": 0.91,
     "extractedSlots": { "references": ["REF1", "REF2"] },
     "missingSlots": [],
     "action": "lookup"
   }
   ```
4. **Use that JSON to route execution** rather than running the model response through regex.
5. **Log intent decisions** to SQL alongside the interaction so you can see where confidence is low and refine the taxonomy over time.

---

## Confidence Thresholds

| Confidence | Model behaviour |
|---|---|
| ≥ 0.85 + all required slots present | Execute directly |
| ≥ 0.70 + missing slots | Ask for the missing slot(s) by name |
| < 0.70 or ambiguous between interpretations | Present interpretations as clickable options |
| No match to any intent | Fall through to general LLM reply |

These thresholds are starting points. Adjust them by reviewing the interaction logs.

---

## Why This Makes the Model Better

| Without taxonomy | With taxonomy |
|---|---|
| Model guesses what "all" means | Model knows what data shapes are possible |
| Hallucinated reference IDs | Model knows references must come from the user |
| Generic "I don't understand" | Targeted clarification with concrete examples |
| Logic buried in regex | Intent rules are visible, editable, and logged |
| Hard to improve without code changes | Improving accuracy = editing a JSON file |

The model's job shifts from *figuring out the whole problem* to *selecting among known well-defined options* — a much easier task that produces consistently better outputs.
