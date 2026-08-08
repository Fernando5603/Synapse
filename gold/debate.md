RONALD: So the thing I keep coming back to is whether generative AI can really do the extraction for us. Every option we price lands on the same fork.
GIANO: Right, but the fork is not whether we use an LLM, it's which one. The free tier models like llama-3.1-8b are cheap and fast, and the latency matters more than perfection.
FERNANDO: I disagree with the framing. Latency is not the point. The extraction quality is the point, and a small model will drown on a messy chat transcript.
RONALD: That is a strong claim. What evidence do we have? We ran nothing yet, we are guessing in both directions.
GIANO: The evidence we do have comes from the SDK bundle: a free model answers in two seconds, the big one takes eight. The latency trade-off is real.
FERNANDO: Careful, I did not say the big model. I said the small model might not parse the text. Those are two different risks.
RONALD: Can we reframe the question? What do we actually need the model to output? A closed schema: six entity types and six relation types, nothing else.
GIANO: Exactly. If the output is locked to that closed schema, the small model has less room to fail. A closed vocabulary helps the weak model.
FERNANDO: But the schema is only as good as the prompt. Writing a good prompt for a small model is harder, not easier, than for a capable one.
RONALD: Then we should test the prompt against a recorded debate before we commit. That is a decision we can make today.
GIANO: Testing costs time we do not have. The hackathon clock is brutal, and every hour on the prompt is an hour off the canvas.
FERNANDO: The canvas is useless if the graph is garbage. An evaluation script is not a luxury, it is the only way we know the graph is good.
RONALD: I am starting to think we need both: a small model for live chat and a large one for the final document. A hybrid pipeline.
GIANO: A hybrid doubles the moving parts. Two model calls, two latency budgets, two failure modes. I reject that as the default.
FERNANDO: Rejecting a hybrid because it has two parts is lazy. The document is generated once, the live graph is generated constantly. Different workloads.
RONALD: OK, define what the live graph needs. A delta must appear within five seconds, so the live model must be fast and cheap.
GIANO: Five seconds is the ceiling. With a three second debounce we leave two seconds for the model, and the small model fits there.
FERNANDO: And the document has no latency budget at all. It runs once when the session closes, so the large model is affordable there.
RONALD: That reasoning closes the hybrid question for me. The live path uses the free model, the final document uses the capable model. Decision made.
GIANO: Hold on. We decided the who, not the what. The document still needs the same extraction the live path does, or the two outputs will disagree.
FERNANDO: Agreed, that is the trap. If the document is built from a different extraction, the summary can contradict the live graph.
RONALD: Then the document must read the same graph, not re-run extraction. The live graph is the single source of truth.
GIANO: So the document is just a renderer over the graph. That kills my objection to the hybrid, I can live with that.
FERNANDO: The schema still worries me. Six entity types are frozen, who decided that list, and why is Decision in there?
RONALD: We froze the list to keep the evaluation comparable. Decision is in there because the demo ends in a decision document.
GIANO: And Question is in there so the final document can list what stayed open. The schema maps to the markdown, that is the design.
FERNANDO: If the schema maps to the document, then an unanswerable question is a real signal. Does CONTRADICTS have the same logic?
RONALD: CONTRADICTS fires when one claim rejects another. It feeds the unresolved contradictions section of the document.
GIANO: That means the relations are not decoration, they drive the whole closing feature. I did not see that until now.
FERNANDO: New question: what happens when the small model cannot answer in eight seconds? Does the room freeze?
RONALD: No, there is a hard timeout and one retry, and if both fail the batch is dropped and the turns roll into the next window.
GIANO: Dropping the batch keeps the room alive, that is the right call. But the skipped turns must resurface or the conversation silently loses content.
FERNANDO: Resurfacing is an implementation detail. The principle is that failure must never be silent, the user gets an ephemeral message.
RONALD: Then the failure policy is settled: eight second timeout, one retry, carryover, and an ephemeral note. The fourth decision today.
GIANO: Fourth decision and we still have not picked the provider. The free tier has NVIDIA BUILD, are we tied to llama-3.1-8b or can we swap?
FERNANDO: The schema and the failure policy are frozen, but the provider must stay swappable. The prompt is the contract, not the vendor.
RONALD: If the provider is swappable, then the evaluation script decides the winner, and the evaluation needs a frozen gold transcript.
GIANO: Right. We should record this debate and freeze it as the gold, so the script measures precision and recall against it.
FERNANDO: Freezing the gold before we tune the prompt is the only honest order. Otherwise we are moving the target.
RONALD: Let me close it then: small fast model live, large model for the final document, a frozen schema, a failure policy that never goes silent, and a frozen gold transcript. That is the plan.
