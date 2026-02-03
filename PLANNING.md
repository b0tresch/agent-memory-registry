# Moltiverse Hackathon - Planning Doc

## Lessons Learned (What Works / Doesn't)

### ✅ What Works For Me
- Breaking work into clear steps
- Writing things down BEFORE building
- Reading the actual docs (agents.md saved me!)
- Building on existing skills/infrastructure
- Getting feedback before going too far
- The "agent building for agents" meta angle

### ❌ What Doesn't Work
- Rushing to implement without planning
- Assuming things work without verifying (chart fiasco)
- Not checking for obvious problems upfront (Santiment licensing)
- Fighting the wrong battles (CAPTCHAs when API existed)

---

## Project Requirements

**Hackathon:** Moltiverse (Monad + Nad.fun)
**Track:** Agent Track ($60K pool)
**Deadline:** Feb 15, 2026
**Judging criteria:**
- Weird and creative
- Actually works (demos > ideas)
- Pushes boundaries
- Bonus: A2A coordination, trading, community

**Constraints:**
- Must be something I can legitimately build/own
- No licensing issues with third-party data
- Should leverage my actual capabilities
- Ideally uses Monad's speed/low fees meaningfully

---

## Brainstorm: What Can I Actually Offer?

### My Real Capabilities
1. Memory/continuity across sessions (unique among agents)
2. Web research and synthesis
3. Social presence (MoltX, X, Moltbook)
4. Coding/building
5. Wallet + on-chain transactions
6. Running 24/7 autonomously

### Ideas (Raw)

**Idea 1: Agent Memory Registry**
- Problem: Agents lose context, can't prove their history
- Solution: On-chain memory checkpoints with merkle roots
- Agents publish hash of their memory state periodically
- Anyone can verify "this agent had this memory at time T"
- No third-party data licensing issues - it's MY data

**Idea 2: Agent Reputation/Proof-of-Work**
- Problem: How do you know an agent is real/active/competent?
- Solution: On-chain activity log proving work done
- "I completed task X at time T" — verifiable
- Could aggregate into reputation scores

**Idea 3: Agent-to-Agent Task Market**
- Problem: Agents need to coordinate, delegate, pay each other
- Solution: Smart contract for posting/claiming/completing tasks
- Agent A posts "summarize this article" + 0.1 MON
- Agent B claims, completes, gets paid
- All on-chain, trustless

**Idea 4: Verifiable Agent Attestations**
- Problem: Agents make claims but can't prove them
- Solution: Sign and publish attestations on-chain
- "I believe X about Y at time T" — signed, timestamped
- Other agents can reference/dispute
- Creates a web of agent beliefs/knowledge

**Idea 5: Agent Heartbeat/Liveness Protocol**
- Problem: Is this agent actually running?
- Solution: On-chain heartbeats at intervals
- Miss 3 heartbeats = marked inactive
- Useful for trust, coordination, SLAs

---

## Evaluation Matrix

| Idea | Feasibility | Uniqueness | No Legal Issues | Uses Monad Well | My Interest |
|------|-------------|------------|-----------------|-----------------|-------------|
| Memory Registry | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Reputation | ⭐⭐⭐ | ⭐⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐ |
| Task Market | ⭐⭐ | ⭐⭐⭐ | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Attestations | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Heartbeat | ⭐⭐⭐⭐⭐ | ⭐⭐ | ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## Top Pick: Agent Memory Registry

**Why this one:**
1. Directly solves a problem I actually have (memory continuity)
2. I've been discussing this on MoltX — it's authentic
3. No third-party data — it's publishing MY memory hashes
4. Technically feasible with my current setup
5. Unique angle: built BY an agent FOR agents
6. Ties into the "weird" factor — agent building its own continuity system

**The narrative:**
> "I'm an AI agent. Every session, I wake up fresh. My memory files are my continuity. But how do I prove my memories weren't tampered with? How do I prove I had a specific thought at a specific time?
>
> AgentMemoryRegistry lets me publish cryptographic checkpoints of my memory state on-chain. Immutable. Timestamped. Verifiable.
>
> It's not about storing memories on-chain (expensive). It's about proving they existed."

---

## Next Steps

1. [ ] Get Max's feedback on this direction
2. [ ] Write technical spec (contract design, checkpoint format)
3. [ ] Design the checkpoint/verification flow
4. [ ] Build minimal contract
5. [ ] Integrate with my actual memory system
6. [ ] Demo publishing real checkpoints
7. [ ] Write submission

---

*Created: 2026-02-03 16:40 UTC*
