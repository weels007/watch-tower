"""Watchtower integration tests — full consensus path (GLSim / Studio / testnet).

Deterministic flow (no LLM needed, runs on localnet GLSim):
  gltest tests/integration/ -v -s --network localnet

LLM evaluation (needs real validators + LLM, e.g. studionet which is gasless):
  gltest tests/integration/test_watchtower_integration.py::test_evaluate_reaches_consensus -v -s --network studionet
"""

from gltest import get_contract_factory
from gltest.assertions import tx_execution_failed, tx_execution_succeeded

PID = "eth-validators"


def _deploy():
    factory = get_contract_factory("WatchtowerInsurance")
    return factory.deploy(args=[])


def _register(contract, pid=PID):
    receipt = contract.register_protocol(
        args=[
            pid,
            "ETH Validators",
            "https://example.org/monitor",
            "beacon API + status page",
            "Slash on double-sign or downtime over 10 minutes proven by API or status page.",
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)


def test_register_purchase_report_views():
    contract = _deploy()
    _register(contract)

    receipt = contract.purchase_coverage(args=[PID, 1500]).transact(value=2000)
    assert tx_execution_succeeded(receipt)
    assert contract.get_pool_balance(args=[]).call() == 2000

    policy = contract.get_policy(args=["1"]).call()
    assert policy["coverage"] == 1500
    assert policy["active"] is True
    assert contract.list_policies(args=[]).call() == ["1"]

    receipt = contract.report_incident(
        args=[PID, "https://example.org/evidence/1", "Validator missed attestations 30min"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    incident = contract.get_incident(args=["1"]).call()
    assert incident["status"] == "pending"
    assert incident["protocol_id"] == PID

    assert PID in contract.list_protocols(args=[]).call()
    assert "1" in contract.list_incidents(args=[]).call()


def test_purchase_reverts_without_premium():
    contract = _deploy()
    _register(contract, pid="bridge-relayer")

    receipt = contract.purchase_coverage(args=["bridge-relayer", 100]).transact(value=0)
    assert tx_execution_failed(receipt)


def test_claim_reverts_before_confirmation():
    contract = _deploy()
    _register(contract, pid="oracle-feed")

    receipt = contract.purchase_coverage(args=["oracle-feed", 500]).transact(value=500)
    assert tx_execution_succeeded(receipt)

    receipt = contract.report_incident(
        args=["oracle-feed", "https://example.org/evidence/2", "Feed allegedly stale"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    # incident still pending -> payout must fail (no state change)
    receipt = contract.payout_claim(args=["1", "1"]).transact()
    assert tx_execution_failed(receipt)


def test_evaluate_reaches_consensus():
    """Needs real LLM + web validators (studionet/testnet, NOT plain GLSim w/o keys).

    Uses https://example.org as stable, always-reachable evidence so leaders
    and validators fetch identical content. Asserts only the consensus path
    (status leaves pending), not the judgment itself.
    """
    contract = _deploy()
    _register(contract, pid="web-service")

    receipt = contract.report_incident(
        args=[
            "web-service",
            "https://example.org",
            "Service allegedly breached latency SLA for 30 minutes",
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)

    receipt = contract.evaluate_incident(args=["1"]).transact()
    assert tx_execution_succeeded(receipt)

    incident = contract.get_incident(args=["1"]).call()
    assert incident["status"] in ("confirmed_violation", "confirmed_no_payout", "rejected")
    assert incident["severity"] in ("none", "low", "medium", "high", "critical")


# ---------- full method coverage on real consensus ----------

# Stable deterministic evidence: httpbin base64-echoes this exact text (HTTP 200),
# so leader and validators judge identical content. Decodes to:
# "WATCHTOWER EVIDENCE: Validator 0xABC double-signed block 12345.
#  Beacon API shows conflicting attestations at slot 777."
VIOLATION_EVIDENCE_URL = (
    "https://httpbin.org/base64/V0FUQ0hUT1dFUiBFVklERU5DRTogVmFsaWRhdG9yIDB4QUJDIGRvdWJsZS1zaWduZWQg"
    "YmxvY2sgMTIzNDUuIEJlYWNvbiBBUEkgc2hvd3MgY29uZmxpY3RpbmcgYXR0ZXN0YXRpb25zIGF0IHNsb3QgNzc3Lg=="
)
VIOLATION_CONDITIONS = (
    "Violation if the reporter evidence page documents a double-sign by validator 0xABC, "
    "such as conflicting attestations for the same slot."
)


def _register_slashable(contract, pid="slashable-validators"):
    receipt = contract.register_protocol(
        args=[
            pid,
            "Slashable Validators",
            "https://example.org/monitor",
            "beacon API",
            VIOLATION_CONDITIONS,
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)
    return pid


def test_admin_activate_deactivate():
    contract = _deploy()
    _register(contract, pid="toggle-service")

    receipt = contract.set_protocol_active(args=["toggle-service", False]).transact()
    assert tx_execution_succeeded(receipt)
    assert contract.get_protocol(args=["toggle-service"]).call()["active"] is False

    receipt = contract.purchase_coverage(args=["toggle-service", 100]).transact(value=100)
    assert tx_execution_failed(receipt)

    receipt = contract.set_protocol_active(args=["toggle-service", True]).transact()
    assert tx_execution_succeeded(receipt)
    assert contract.get_protocol(args=["toggle-service"]).call()["active"] is True

    receipt = contract.purchase_coverage(args=["toggle-service", 100]).transact(value=100)
    assert tx_execution_succeeded(receipt)


def test_full_payout_and_withdraw():
    contract = _deploy()
    pid = _register_slashable(contract)

    receipt = contract.purchase_coverage(args=[pid, 1500]).transact(value=2000)
    assert tx_execution_succeeded(receipt)
    from eth_utils import to_checksum_address
    from genlayer_py.types import CalldataAddress

    holder = CalldataAddress(
        to_checksum_address(contract.get_policy(args=["1"]).call()["holder"])
    )

    receipt = contract.report_incident(
        args=[pid, VIOLATION_EVIDENCE_URL, "Validator 0xABC double-signed block 12345"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    receipt = contract.evaluate_incident(args=["1"]).transact()
    assert tx_execution_succeeded(receipt)
    incident = contract.get_incident(args=["1"]).call()
    if incident["status"] == "pending":
        # Undetermined consensus round applies no state change - retry once
        # with a fresh leader/validator round (correct client behavior).
        receipt = contract.evaluate_incident(args=["1"]).transact()
        assert tx_execution_succeeded(receipt)
        incident = contract.get_incident(args=["1"]).call()
    assert incident["status"] == "confirmed_violation", f"LLM rejected: {incident}"

    receipt = contract.payout_claim(args=["1", "1"]).transact()
    assert tx_execution_succeeded(receipt)

    paid = contract.get_incident(args=["1"]).call()
    # incident stays open for other holders; payouts accumulate per policy
    assert paid["status"] == "confirmed_violation"
    assert paid["payout_amount"] == 1500
    assert contract.get_pool_balance(args=[]).call() == 500
    assert contract.get_claimable(args=[holder]).call() == 1500
    assert contract.get_policy(args=["1"]).call()["active"] is False

    receipt = contract.withdraw().transact()
    assert tx_execution_succeeded(receipt)
    assert contract.get_claimable(args=[holder]).call() == 0

    # double-claim, re-evaluate of decided incident, and empty withdraw must fail
    assert tx_execution_failed(contract.payout_claim(args=["1", "1"]).transact())
    assert tx_execution_failed(contract.evaluate_incident(args=["1"]).transact())
    assert tx_execution_failed(contract.withdraw().transact())


def _evaluate_until_decided(contract, incident_id="1"):
    receipt = contract.evaluate_incident(args=[incident_id]).transact()
    assert tx_execution_succeeded(receipt)
    incident = contract.get_incident(args=[incident_id]).call()
    if incident["status"] == "pending":
        receipt = contract.evaluate_incident(args=[incident_id]).transact()
        assert tx_execution_succeeded(receipt)
        incident = contract.get_incident(args=[incident_id]).call()
    return incident


def test_two_policies_claim_same_incident():
    """Steward case: one incident serves many holders; double-claim blocked."""
    contract = _deploy()
    pid = _register_slashable(contract)

    receipt = contract.purchase_coverage(args=[pid, 1000]).transact(value=1000)
    assert tx_execution_succeeded(receipt)
    receipt = contract.purchase_coverage(args=[pid, 1000]).transact(value=1000)
    assert tx_execution_succeeded(receipt)

    receipt = contract.report_incident(
        args=[pid, VIOLATION_EVIDENCE_URL, "Validator 0xABC double-signed block 12345"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    incident = _evaluate_until_decided(contract)
    assert incident["status"] == "confirmed_violation", f"LLM rejected: {incident}"

    receipt = contract.payout_claim(args=["1", "1"]).transact()
    assert tx_execution_succeeded(receipt)
    assert contract.get_incident(args=["1"]).call()["status"] == "confirmed_violation"
    assert contract.get_incident(args=["1"]).call()["payout_amount"] == 1000

    receipt = contract.payout_claim(args=["2", "1"]).transact()
    assert tx_execution_succeeded(receipt)
    assert contract.get_incident(args=["1"]).call()["payout_amount"] == 2000
    assert contract.get_pool_balance(args=[]).call() == 0  # 2000 - 1000 - 1000


def test_post_incident_policy_cannot_claim():
    """Steward case: coverage bought after the report cannot claim on it."""
    contract = _deploy()
    pid = _register_slashable(contract)

    receipt = contract.report_incident(
        args=[pid, VIOLATION_EVIDENCE_URL, "Validator 0xABC double-signed block 12345"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    # on-chain seconds separate report and purchase: coverage is newer
    receipt = contract.purchase_coverage(args=[pid, 1000]).transact(value=1000)
    assert tx_execution_succeeded(receipt)

    incident = _evaluate_until_decided(contract)
    assert incident["status"] == "confirmed_violation", f"LLM rejected: {incident}"

    receipt = contract.payout_claim(args=["1", "1"]).transact()
    assert tx_execution_failed(receipt)


def test_claim_gates_non_holder_mismatch():
    from gltest import create_account

    factory = get_contract_factory("WatchtowerInsurance")
    contract = factory.deploy(args=[])
    _register_slashable(contract, pid="proto-a")
    _register(contract, pid="proto-b")

    receipt = contract.purchase_coverage(args=["proto-a", 500]).transact(value=500)
    assert tx_execution_succeeded(receipt)

    receipt = contract.report_incident(
        args=["proto-a", "https://example.org/evidence/x", "Alleged downtime"]
    ).transact()
    assert tx_execution_succeeded(receipt)
    receipt = contract.report_incident(
        args=["proto-b", "https://example.org/evidence/y", "Alleged downtime"]
    ).transact()
    assert tx_execution_succeeded(receipt)

    # non-holder cannot claim
    stranger = create_account()
    stranger_view = factory.build_contract(contract.address, account=stranger)
    assert tx_execution_failed(stranger_view.payout_claim(args=["1", "1"]).transact())

    # holder cannot mix policy and incident from different protocols (pending incident)
    assert tx_execution_failed(contract.payout_claim(args=["1", "2"]).transact())

    # non-owner cannot toggle protocol status
    assert tx_execution_failed(
        stranger_view.set_protocol_active(args=["proto-a", False]).transact()
    )
