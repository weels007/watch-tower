# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Watchtower - Slashing Monitoring and Insurance (GenLayer Intelligent Contract).

Hybrid monitoring (on-chain report + off-chain web evidence) with
fully automatic LLM evaluation via GenLayer consensus + insurance pool payouts.

Flow:
  1. owner register_protocol(...) - monitored service + slash conditions + sources
  2. user purchase_coverage(...) payable - premium masuk pool, polis terbit
  3. anyone report_incident(...) - laporan pelanggaran + evidence_url
  4. anyone evaluate_incident(...) - LLM+web consensus: violation? severity? payout?
  5. holder payout_claim(...) - payout dari pool ke claimable balance
  6. holder withdraw() - real GEN transfer to holder wallet via emit_transfer

Boundary:
  - GenLayer owns: evidence fetch, LLM judgment, consensus on violation/payout,
    pool accounting state transition.
  - Frontend/backend owns: indexing, alerting, cached dashboards.
  - External sources own: raw facts (API status, berita, attestation).
"""

from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
import json

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

# Minimum premium rate enforced in purchase_coverage: 1 percent of coverage.
# Explicit on-chain rule so the shared pool cannot be drained by
# underpriced coverage (premium * 100 >= coverage).


def _now() -> u256:
    # Deterministic tx timestamp: identical for leader and validators.
    return u256(int(datetime.now(timezone.utc).timestamp()))


@gl.evm.contract_interface
class _EoaPayout:
    # Recipient lives on the chain layer (EOA), so payouts go out as an
    # external message through the ghost contract (see value-transfers docs).
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class Protocol:
    name: str
    monitor_endpoint: str
    evidence_source: str
    slash_conditions: str
    active: bool
    total_policies: u256


@allow_storage
@dataclass
class Policy:
    holder: Address
    protocol_id: str
    premium: u256
    coverage: u256
    active: bool
    created_at: u256  # tx timestamp: coverage must predate any incident it claims on


@allow_storage
@dataclass
class Incident:
    protocol_id: str
    reporter: Address
    evidence_url: str
    description: str
    # pending | confirmed_violation | confirmed_no_payout | rejected
    # (never "paid": payouts are tracked per policy so one incident can serve
    # many holders without closing for the rest)
    status: str
    severity: str  # none | low | medium | high | critical
    confidence: u256  # 0-100
    reasoning: str
    payout_amount: u256  # cumulative across all policies that claimed
    reported_at: u256  # tx timestamp of the report


class WatchtowerInsurance(gl.Contract):
    owner: Address
    protocols: TreeMap[str, Protocol]
    protocol_ids: DynArray[str]
    policies: TreeMap[str, Policy]
    policy_ids: DynArray[str]
    incidents: TreeMap[str, Incident]
    incident_ids: DynArray[str]
    claimable: TreeMap[Address, u256]
    pool_balance: u256
    policy_counter: u256
    incident_counter: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pool_balance = u256(0)
        self.policy_counter = u256(0)
        self.incident_counter = u256(0)

    # ---------- admin ----------

    @gl.public.write
    def register_protocol(
        self,
        protocol_id: str,
        name: str,
        monitor_endpoint: str,
        evidence_source: str,
        slash_conditions: str,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can register protocols")
        if protocol_id == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} protocol_id empty")
        if protocol_id in self.protocols:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} protocol already registered")
        self.protocols[protocol_id] = Protocol(
            name=name,
            monitor_endpoint=monitor_endpoint,
            evidence_source=evidence_source,
            slash_conditions=slash_conditions,
            active=True,
            total_policies=u256(0),
        )
        self.protocol_ids.append(protocol_id)

    @gl.public.write
    def set_protocol_active(self, protocol_id: str, active: bool) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner")
        if protocol_id not in self.protocols:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Protocol not found")
        proto = self.protocols[protocol_id]
        proto.active = active
        self.protocols[protocol_id] = proto

    # ---------- coverage / pool ----------

    @gl.public.write.payable
    def purchase_coverage(self, protocol_id: str, coverage: u256) -> str:
        if protocol_id not in self.protocols:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Protocol not found")
        proto = gl.storage.copy_to_memory(self.protocols[protocol_id])
        if not proto.active:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Protocol inactive")
        if coverage <= u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Coverage must be > 0")
        premium: u256 = gl.message.value
        if premium <= u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Premium (payable value) must be > 0")
        if premium * u256(100) < coverage:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Premium below 1 percent of coverage")

        self.policy_counter = self.policy_counter + u256(1)
        policy_id = str(int(self.policy_counter))
        holder = gl.message.sender_address
        self.policies[policy_id] = Policy(
            holder=holder,
            protocol_id=protocol_id,
            premium=premium,
            coverage=coverage,
            active=True,
            created_at=_now(),
        )
        self.policy_ids.append(policy_id)
        proto.total_policies = proto.total_policies + u256(1)
        self.protocols[protocol_id] = proto
        self.pool_balance = self.pool_balance + premium
        return policy_id

    # ---------- incident reporting ----------

    @gl.public.write
    def report_incident(
        self, protocol_id: str, evidence_url: str, description: str
    ) -> str:
        if protocol_id not in self.protocols:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Protocol not found")
        if evidence_url == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evidence_url empty")
        self.incident_counter = self.incident_counter + u256(1)
        incident_id = str(int(self.incident_counter))
        self.incidents[incident_id] = Incident(
            protocol_id=protocol_id,
            reporter=gl.message.sender_address,
            evidence_url=evidence_url,
            description=description,
            status="pending",
            severity="none",
            confidence=u256(0),
            reasoning="",
            payout_amount=u256(0),
            reported_at=_now(),
        )
        self.incident_ids.append(incident_id)
        return incident_id

    # ---------- LLM evaluation (core) ----------

    @gl.public.write
    def evaluate_incident(self, incident_id: str) -> None:
        if incident_id not in self.incidents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Incident not found")
        inc = gl.storage.copy_to_memory(self.incidents[incident_id])
        if inc.status != "pending":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Incident already evaluated")
        proto = gl.storage.copy_to_memory(self.protocols[inc.protocol_id])

        # copy to plain memory for nondet closure (storage inaccessible inside)
        protocol_id = str(inc.protocol_id)
        protocol_name = str(proto.name)
        slash_conditions = str(proto.slash_conditions)
        monitor_endpoint = str(proto.monitor_endpoint)
        evidence_source = str(proto.evidence_source)
        evidence_url = str(inc.evidence_url)
        description = str(inc.description)

        def leader_fn():
            def _status(resp) -> int:
                if hasattr(resp, "status"):
                    return int(resp.status)
                if hasattr(resp, "status_code"):
                    return int(resp.status_code)
                return 200

            def _body(resp) -> str:
                b = resp.body
                if isinstance(b, bytes):
                    return b.decode("utf-8", errors="replace")
                return str(b)

            # 1. fetch reporter evidence (best-effort, never crash consensus on fetch)
            reporter_text = ""
            try:
                r = gl.nondet.web.get(evidence_url)
                code = _status(r)
                if code >= 500:
                    raise gl.vm.UserError(
                        f"{ERROR_TRANSIENT} evidence_url 5xx: {code}"
                    )
                if code >= 400:
                    reporter_text = f"[UNREACHABLE evidence_url status={code}]"
                else:
                    reporter_text = _body(r)[:6000]
            except gl.vm.UserError:
                raise
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} evidence fetch failed: {e}")

            # 2. fetch canonical monitor source (best-effort)
            monitor_text = ""
            try:
                m = gl.nondet.web.get(monitor_endpoint)
                code = _status(m)
                if code < 400:
                    monitor_text = _body(m)[:6000]
                else:
                    monitor_text = f"[monitor status={code}]"
            except Exception:
                monitor_text = "[monitor unreachable]"

            prompt = f"""You are Watchtower, a slashing-monitor and insurance adjudicator.
Protocol: {protocol_name} ({protocol_id})
Slash conditions (authoritative): {slash_conditions}
Canonical source hint: {evidence_source}
Monitor snapshot: {monitor_text}
Reporter claim: {description}
Reporter evidence page: {reporter_text}

Decide STRICTLY against slash conditions using available evidence.
Return JSON with keys:
- "violation": true/false
- "severity": one of "none","low","medium","high","critical" ("none" if no violation)
- "confidence": integer 0-100
- "payout_eligible": true/false (true only if violation==true and evidence supports payout)
- "reasoning": short explanation citing evidence
"""
            analysis = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(analysis, dict):
                raise gl.vm.UserError(f"{ERROR_LLM} LLM non-dict: {type(analysis)}")
            return {
                "violation": bool(analysis.get("violation", False)),
                "severity": str(analysis.get("severity", "none")),
                "confidence": analysis.get("confidence", 0),
                "payout_eligible": bool(analysis.get("payout_eligible", False)),
                "reasoning": str(analysis.get("reasoning", ""))[:2000],
            }

        def _parse_conf(v) -> u256:
            try:
                n = int(float(str(v).strip()))
            except Exception:
                raise gl.vm.UserError(f"{ERROR_LLM} bad confidence: {v}")
            if n < 0:
                n = 0
            if n > 100:
                n = 100
            return u256(n)

        def _handle_leader_error(leaders_res, fn) -> bool:
            leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
            try:
                fn()
                return False
            except gl.vm.UserError as e:
                validator_msg = e.message if hasattr(e, "message") else str(e)
                if validator_msg.startswith(
                    ERROR_EXPECTED
                ) or validator_msg.startswith(ERROR_EXTERNAL):
                    return validator_msg == leader_msg
                if validator_msg.startswith(ERROR_TRANSIENT) and str(
                    leader_msg
                ).startswith(ERROR_TRANSIENT):
                    return True
                return False
            except Exception:
                return False

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            try:
                mine = leader_fn()
            except Exception:
                return False
            lead = leaders_res.calldata
            if not isinstance(lead, dict) or not isinstance(mine, dict):
                return False
            if lead.get("severity") not in (
                "none",
                "low",
                "medium",
                "high",
                "critical",
            ):
                return False
            # decision fields must match exactly; reasoning may differ
            if bool(lead.get("violation")) != bool(mine.get("violation")):
                return False
            if bool(lead.get("payout_eligible")) != bool(mine.get("payout_eligible")):
                return False
            if str(lead.get("severity")) != str(mine.get("severity")):
                return False
            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        violation = bool(result.get("violation", False))
        severity = str(result.get("severity", "none"))
        confidence = _parse_conf(result.get("confidence", 0))
        payout_eligible = bool(result.get("payout_eligible", False))
        reasoning = str(result.get("reasoning", ""))[:2000]

        updated = gl.storage.copy_to_memory(self.incidents[incident_id])
        if violation and payout_eligible:
            updated.status = "confirmed_violation"
        elif violation:
            # Violation proven but consensus says no payout (e.g. evidence
            # insufficient for coverage terms). Never payable: payout_claim
            # only accepts confirmed_violation.
            updated.status = "confirmed_no_payout"
        else:
            updated.status = "rejected"
        updated.severity = severity
        updated.confidence = confidence
        updated.reasoning = reasoning
        # payout_amount dihitung saat claim (min coverage, pool) - simpan flag via severity
        updated.payout_amount = u256(0)
        self.incidents[incident_id] = updated

    # ---------- payout ----------

    @gl.public.write
    def payout_claim(self, policy_id: str, incident_id: str) -> None:
        if policy_id not in self.policies:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Policy not found")
        if incident_id not in self.incidents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Incident not found")
        pol = gl.storage.copy_to_memory(self.policies[policy_id])
        inc = gl.storage.copy_to_memory(self.incidents[incident_id])
        if gl.message.sender_address != pol.holder:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only policy holder can claim")
        if not pol.active:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Policy inactive")
        if pol.protocol_id != inc.protocol_id:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Protocol mismatch")
        if inc.status != "confirmed_violation":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Incident not payable")
        if pol.created_at >= inc.reported_at:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Policy must predate incident")
        if self.pool_balance <= u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Pool empty")

        amount = pol.coverage
        if amount > self.pool_balance:
            amount = self.pool_balance
        self.pool_balance = self.pool_balance - amount
        pol.active = False
        self.policies[policy_id] = pol
        # Per-policy tracking: the incident stays confirmed_violation so other
        # eligible holders can still claim. Payouts accumulate on the incident.
        inc.payout_amount = inc.payout_amount + amount
        self.incidents[incident_id] = inc
        prev = self.claimable.get(pol.holder, u256(0))
        self.claimable[pol.holder] = prev + amount

    @gl.public.write
    def withdraw(self) -> None:
        holder = gl.message.sender_address
        bal = self.claimable.get(holder, u256(0))
        if bal <= u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Nothing to withdraw")
        # Real GEN transfer to the holder's wallet (external message via the
        # ghost contract, executes on finalization). Accounting is cleared
        # first so a retry can never double-pay.
        self.claimable[holder] = u256(0)
        _EoaPayout(holder).emit_transfer(value=bal)

    # ---------- views ----------

    @gl.public.view
    def get_protocol(self, protocol_id: str) -> dict:
        p = gl.storage.copy_to_memory(self.protocols[protocol_id])
        return {
            "name": p.name,
            "monitor_endpoint": p.monitor_endpoint,
            "evidence_source": p.evidence_source,
            "slash_conditions": p.slash_conditions,
            "active": p.active,
            "total_policies": int(p.total_policies),
        }

    @gl.public.view
    def get_policy(self, policy_id: str) -> dict:
        p = gl.storage.copy_to_memory(self.policies[policy_id])
        return {
            "holder": str(p.holder),
            "protocol_id": p.protocol_id,
            "premium": int(p.premium),
            "coverage": int(p.coverage),
            "active": p.active,
            "created_at": int(p.created_at),
        }

    @gl.public.view
    def get_incident(self, incident_id: str) -> dict:
        i = gl.storage.copy_to_memory(self.incidents[incident_id])
        return {
            "protocol_id": i.protocol_id,
            "reporter": str(i.reporter),
            "evidence_url": i.evidence_url,
            "description": i.description,
            "status": i.status,
            "severity": i.severity,
            "confidence": int(i.confidence),
            "reasoning": i.reasoning,
            "payout_amount": int(i.payout_amount),
            "reported_at": int(i.reported_at),
        }

    @gl.public.view
    def get_pool_balance(self) -> int:
        return int(self.pool_balance)

    @gl.public.view
    def get_contract_balance(self) -> str:
        # Real GEN held by the contract (premiums in, withdrawals out).
        return str(self.balance)

    @gl.public.view
    def get_claimable(self, holder: Address) -> int:
        return int(self.claimable.get(holder, u256(0)))

    @gl.public.view
    def list_incidents(self) -> list:
        return [i for i in self.incident_ids]

    @gl.public.view
    def list_protocols(self) -> list:
        return [p for p in self.protocol_ids]

    @gl.public.view
    def list_policies(self) -> list:
        return [p for p in self.policy_ids]
