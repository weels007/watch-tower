#!/usr/bin/env python3
"""Deploy WatchtowerInsurance using the `global` wallet keystore.

Usage (from project root):
  python deploy/deploy_watchtower.py --network localnet
  python deploy/deploy_watchtower.py --network studionet

- Reads keystore + password from D:\\Genlayer-project\\weels\\wallet\\
  (global-keystore.json + global.password). Nothing else is touched.
- Prints the deployed contract address and saves it to
  deploy/watchtower.<network>.address
- Never prints the private key or password.
"""

import argparse
import json
import pathlib
import sys

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
WALLET_DIR = pathlib.Path(r"D:\Genlayer-project\weels\wallet")
CONTRACT_FILE = PROJECT_ROOT / "contracts" / "watchtower_insurance.py"

NETWORKS = {
    "localnet": "http://127.0.0.1:4000/api",
    "studionet": "https://studio.genlayer.com/api",
}


def load_global_account():
    from eth_account import Account
    from genlayer_py import create_account

    keystore = json.loads((WALLET_DIR / "global-keystore.json").read_text())
    password = (WALLET_DIR / "global.password").read_text().strip()
    private_key = Account.decrypt(keystore, password)
    account = create_account(private_key)
    print(f"Deployer: {account.address}")
    return account


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy WatchtowerInsurance")
    parser.add_argument("--network", choices=list(NETWORKS), default="localnet")
    args = parser.parse_args()

    if not CONTRACT_FILE.exists():
        print(f"Contract not found: {CONTRACT_FILE}", file=sys.stderr)
        return 1

    from genlayer_py import chains, create_client
    from gltest.assertions import tx_execution_succeeded
    from gltest.utils import extract_contract_address

    account = load_global_account()
    chain = getattr(chains, args.network)
    client = create_client(
        chain=chain, account=account, endpoint=NETWORKS[args.network]
    )

    code = CONTRACT_FILE.read_text(encoding="utf-8")
    print(f"Deploying WatchtowerInsurance to {args.network} ...")
    tx_hash = client.deploy_contract(code=code, args=[], account=account)
    print(f"Deploy tx: {tx_hash}")

    receipt = client.wait_for_transaction_receipt(transaction_hash=tx_hash)
    if not tx_execution_succeeded(receipt):
        print(f"Deployment failed: {receipt}", file=sys.stderr)
        return 1

    address = extract_contract_address(receipt)
    print(f"WatchtowerInsurance deployed at: {address}")

    out = PROJECT_ROOT / "deploy" / f"watchtower.{args.network}.address"
    out.write_text(str(address))
    print(f"Address saved to: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
