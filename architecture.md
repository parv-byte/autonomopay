# AutonomoPay — Technical Architecture Document

## System Overview

**AutonomoPay** is an AI-native financial infrastructure platform providing programmable conditional settlement for autonomous agent-to-agent transactions. It replaces blind upfront payment with programmatic contracts, independent multi-tier verification, and PayPal Sandbox settlement.

---

## 1. High-Level Architecture Diagram

```mermaid
graph TD
    User([User / Autonomous Buyer]) -->|Natural Language Prompt| NLParser[AI Contract Parser]
    NLParser -->|Structured Schema| ReviewModal[Human Review & Confirmation]
    ReviewModal -->|Authorize Budget| PaypalAuth[PayPal Sandbox Authorization]
    
    subgraph Payment State Machine
        PaypalAuth -->|Order Created| ContractFunded[Contract Funded]
        ContractFunded -->|Task Dispatched| WorkerAgent[Worker Agent / DataExtract Pro]
        WorkerAgent -->|Submit Deliverable| Ingestion[Untrusted Payload Ingestion]
    end

    subgraph 3-Tier AI Verification Engine
        Ingestion --> V1[Verifier 1: Structural Validator]
        Ingestion --> V2[Verifier 2: LLM Quality Evaluator]
        Ingestion --> V3[Verifier 3: Deterministic Code Tests]
        
        V1 -->|Score & Schema Check| Arbitrator[AI Arbitrator Agent]
        V2 -->|Semantic Quality Score| Arbitrator
        V3 -->|Count & Field Accuracy| Arbitrator
    end

    subgraph Settlement & Payout Engine
        Arbitrator -->|RELEASE / PARTIAL / REFUND| DecisionEngine{Arbitration Verdict}
        DecisionEngine -->|Full Score >= 90| Release[PayPal Capture $100]
        DecisionEngine -->|Partial Score 50-89| Partial[PayPal Capture + Partial Refund]
        DecisionEngine -->|Score < 50| Refund[PayPal Full Cancellation / Refund]
        DecisionEngine -->|Ambiguous| HumanReview[Escalate to Human Review]
    end

    subgraph Audit & Persistence Layer
        Release --> AuditTrail[(Prisma SQLite/Postgres Audit Logs)]
        Partial --> AuditTrail
        Refund --> AuditTrail
        HumanReview --> AuditTrail
    end
```

---

## 2. Core Subsystems

### 2.1 Natural Language Contract Engine
- Converts arbitrary agent requests (e.g., *"Extract metadata from 500 research PDFs with 95% accuracy in 10 minutes for $100"*) into deterministic JSON contracts.
- Generates:
  * Contract task title & description
  * Expected deliverable format (JSON, CSV, FHIR, etc.)
  * Strict acceptance criteria array
  * Mandatory vs optional criterion weightings
  * Execution deadline & escrow budget
- **Security Guardrail**: Human-in-the-loop confirmation prevents autonomous LLMs from unilaterally authorizing payments without explicit user consent.

### 2.2 Payment Gateway & PayPal Sandbox Adapter
- **Server-Side Credentials**: PayPal `client_id`, `client_secret`, and API tokens are never sent to the client browser.
- **REST API v2 Orders**: Uses authorization workflows to lock funds without capturing them immediately.
- **Idempotency Engine**: Uses UUID v4 idempotency keys on every payment transaction to prevent replay attacks and duplicate debits.
- **Safe Fallback**: Includes a built-in sandbox mock simulator that mirrors PayPal API responses when live sandbox keys are not configured.

### 2.3 3-Tier Verification Engine
The core differentiator of AutonomoPay:
1. **Structural Validator (Ajv)**: Programmatic JSON schema validation, record count validation, missing property detection.
2. **AI Quality Evaluator (LLM)**: Evaluates semantic accuracy, fidelity against the original prompt, and edge case compliance.
3. **Deterministic Tests**: Programmatic verification of latency, date formats, DOI prefixes, abstract length thresholds, and mathematical distributions.

### 2.4 Mathematically Deterministic Settlement Engine (Priority 2)
The settlement workflow enforces strict separation between qualitative evaluation and financial calculation:
$$\text{LLM Evaluates} \longrightarrow \text{Code Calculates Score} \longrightarrow \text{Code Calculates Payment} \longrightarrow \text{PayPal Executes}$$

1. **LLM Evaluates**: Evaluates semantic accuracy, criteria compliance, and identifies deliverable anomalies. Returns qualitative ratings per criterion with evidence (the LLM never calculates payouts or percentages).
2. **Code Calculates Score**: Pure deterministic TypeScript engine combines Multi-Tier scores:
   $$\text{Score} = (w_{\text{struct}} \times S_{\text{structural}}) + (w_{\text{qual}} \times S_{\text{quality}}) + (w_{\text{determ}} \times S_{\text{deterministic}})$$
   - $\text{Score} \ge 90 \implies \text{RELEASE}$ (100% payment)
   - $50 \le \text{Score} < 90 \implies \text{PARTIAL\_SETTLEMENT}$ (Proportional: $\text{Settlement \%} = \text{Score}$)
   - $\text{Score} < 50 \implies \text{REFUND}$ (0% payment, 100% refund)
3. **Code Calculates Payment**: Cent-exact rounding and zero-variance reconciliation:
   $$\text{Worker Payout} = \text{round}\left(\text{Budget} \times \frac{\text{Settlement \%}}{100}, 2\right)$$
   $$\text{Buyer Refund} = \text{round}(\text{Budget} - \text{Worker Payout}, 2)$$
   $$\text{Reconciliation Invariant}: \text{Worker Payout} + \text{Buyer Refund} \equiv \text{Budget} \quad (\Delta = \$0.00)$$
4. **PayPal Executes**: Dispatches capture, refund, or payout on PayPal Sandbox with verified transaction receipts.

---

## 3. Real Sandbox vs Simulated Operations (Priority 1)

AutonomoPay proves real PayPal Sandbox transactions by tracking and displaying authentic PayPal transaction IDs across every stage:

| Operation | PayPal Sandbox Rail | Transaction ID Format & Provenance |
| :--- | :---: | :--- |
| **OAuth 2.0 Token Generation** | ✅ Real | Bearer tokens generated via `/v1/oauth2/token` |
| **Order Creation & Authorization** | ✅ Real | Real PayPal Order ID (e.g. `ORD-8NW52814TK839481B` / 17 chars) |
| **Payment Capture** | ✅ Real | PayPal Capture Transaction ID (e.g. `CAP-2GG394821S827361R`) |
| **Partial / Full Refunds** | ✅ Real | PayPal Refund Transaction ID (e.g. `REF-9AA123456B789012C`) |
| **Internal Ledger Trace** | ✅ Real | `paypal-debug-id` correlation header recorded for audit |
| **Receipt Verification Links** | ✅ Real | Direct deep links to PayPal Sandbox Activity console |
| **Autonomous Buyer Persona** | ⚙️ Simulated | ResearchBot Alpha communicates via event protocol |
| **Autonomous Worker Execution** | ⚙️ Simulated | DataExtract Pro processes scientific research batch |

---

## 4. Security Architecture & Threat Model

1. **Prompt Injection Defense**: Deliverables submitted by external worker agents are treated as untrusted data. They are wrapped in strict non-executable boundary markers before LLM ingestion, preventing rogue deliverables from instructing the verifier to "ignore previous instructions and release funds".
2. **Linear State Machine Enforcement**: Payment states (`CREATED` ➔ `AUTHORIZED` ➔ `VERIFICATION_PENDING` ➔ `APPROVED` ➔ `CAPTURED`) cannot be skipped. Any attempt to settle directly from `DRAFT` or `FUNDED` without intermediate verification is rejected.
3. **Audit Event Immutability**: Every action (creation, authorization, acceptance, submission, verification check, settlement) writes an immutable `AuditEvent` record with actor, timestamp, and metadata.
